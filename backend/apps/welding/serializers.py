from rest_framework import serializers

from apps.equipment.models import Equipment
from apps.technology.models import Operation, Part, SeamSpec
from apps.welders.models import Welder
from apps.weldingcards.models import WeldingCard, WeldPass

from .models import (
    ArcRun,
    Inspection,
    OperationRun,
    PartInstance,
    Weld,
    WeldingSession,
    WeldPassRun,
    RouteCode,
)


class PartInstanceSerializer(serializers.ModelSerializer):
    """Изделие с заводским номером."""

    part_id = serializers.PrimaryKeyRelatedField(
        source="part", queryset=Part.objects.all(),
    )
    part_number = serializers.CharField(source="part.number", read_only=True)
    part_name = serializers.CharField(source="part.name", read_only=True)

    witness_for_id = serializers.PrimaryKeyRelatedField(
        source="witness_for", queryset=PartInstance.objects.all(),
        required=False, allow_null=True,
    )
    welds_count = serializers.IntegerField(source="welds.count", read_only=True)

    class Meta:
        model = PartInstance
        fields = [
            "id", "part_id", "part_number", "part_name",
            "serial_no", "kind", "witness_for_id",
            "welds_count", "created_at",
        ]

    def validate(self, attrs):
        kind = attrs.get("kind", getattr(self.instance, "kind", "штатное"))
        witness_for = attrs.get("witness_for")
        if kind != "свидетель" and witness_for:
            raise serializers.ValidationError(
                {"witness_for_id": "Ссылка на изделие заполняется только у свидетеля"}
            )
        return attrs


class InspectionSerializer(serializers.ModelSerializer):
    """Заключение контроля."""

    run_id = serializers.PrimaryKeyRelatedField(
        source="run", queryset=OperationRun.objects.all(),
    )
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    result_display = serializers.CharField(source="get_result_display", read_only=True)

    class Meta:
        model = Inspection
        fields = [
            "id", "run_id",
            "kind", "kind_display",
            "method", "method_display",
            "specimen",
            "result", "result_display",
            "defects",
            "report_no", "inspected_at",
            "inspector_name", "conclusion",
        ]
        read_only_fields = ["inspector_name"]

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["inspector"] = request.user
        return super().create(validated_data)


class WeldPassRunSerializer(serializers.ModelSerializer):
    """Проход по факту со сверкой с планом.

    deviation считается на лету: сравнивать надо средний ток сегментов
    с диапазоном карты, а не максимум — максимум это ток импульса,
    он выше диапазона по определению.
    """

    planned_pass_id = serializers.PrimaryKeyRelatedField(
        source="planned_pass", queryset=WeldPass.objects.all(),
        required=False, allow_null=True,
    )
    match_source_display = serializers.CharField(
        source="get_match_source_display", read_only=True,
    )

    planned_current = serializers.SerializerMethodField()
    actual_current = serializers.SerializerMethodField()
    deviation = serializers.SerializerMethodField()

    class Meta:
        model = WeldPassRun
        fields = [
            "id", "no",
            "planned_pass_id",
            "started_at", "finished_at", "arc_time",
            "match_source", "match_source_display",
            "planned_current", "actual_current", "deviation",
        ]

    def get_planned_current(self, obj) -> dict | None:
        p = obj.planned_pass
        if not p:
            return None
        return {"min": p.current_min, "max": p.current_max}

    def get_actual_current(self, obj) -> dict | None:
        """Средневзвешенного пока не считаем: берём среднее по сегментам."""
        arcs = [a for a in obj.arcs.all() if a.current_avg is not None]
        if not arcs:
            return None
        values = [float(a.current_avg) for a in arcs]
        return {
            "avg": round(sum(values) / len(values), 1),
            "min": min(float(a.current_min) for a in arcs if a.current_min is not None),
            "max": max(float(a.current_max) for a in arcs if a.current_max is not None),
        }

    def get_deviation(self, obj) -> dict | None:
        """Отклонение факта от карты в процентах от границы диапазона."""
        planned = self.get_planned_current(obj)
        actual = self.get_actual_current(obj)
        if not planned or not actual:
            return None

        lo, hi = planned["min"], planned["max"]
        if lo is None or hi is None:
            return None

        avg = actual["avg"]
        if float(lo) <= avg <= float(hi):
            return {"state": "в допуске", "percent": 0}

        if avg > float(hi):
            percent = round((avg - float(hi)) / float(hi) * 100, 1)
            return {"state": "выше", "percent": percent}

        percent = round((float(lo) - avg) / float(lo) * 100, 1)
        return {"state": "ниже", "percent": percent}


class OperationRunSerializer(serializers.ModelSerializer):
    """Выполнение операции."""

    weld_id = serializers.PrimaryKeyRelatedField(
        source="weld", queryset=Weld.objects.all(),
    )
    operation_id = serializers.PrimaryKeyRelatedField(
        source="operation", queryset=Operation.objects.all(),
    )
    operation_number = serializers.CharField(source="operation.number", read_only=True)

    card_id = serializers.PrimaryKeyRelatedField(
        source="card", queryset=WeldingCard.objects.all(),
    )
    card_no = serializers.CharField(source="card.card_no", read_only=True)
    method_name = serializers.CharField(source="card.method.name", read_only=True)

    welder_id = serializers.PrimaryKeyRelatedField(
        source="welder", queryset=Welder.objects.all(),
        required=False, allow_null=True,
    )
    welder_fio = serializers.CharField(source="welder.fio", read_only=True, default="")
    equipment_id = serializers.PrimaryKeyRelatedField(
        source="equipment", queryset=Equipment.objects.all(),
        required=False, allow_null=True,
    )
    equipment_name = serializers.CharField(
        source="equipment.name", read_only=True, default="",
    )

    passes = WeldPassRunSerializer(many=True, read_only=True)
    inspections = InspectionSerializer(many=True, read_only=True)

    shrinkage = serializers.ReadOnlyField()
    # какой контроль назначен технологом после этой операции
    required_controls = serializers.JSONField(
        source="operation.required_controls", read_only=True,
    )
    controls_missing = serializers.SerializerMethodField()

    class Meta:
        model = OperationRun
        fields = [
            "id",
            "weld_id",
            "operation_id", "operation_number",
            "card_id", "card_no", "method_name",
            "welder_id", "welder_fio",
            "equipment_id", "equipment_name",
            "started_at", "finished_at", "status",
            "size_before", "size_after", "measured_at", "shrinkage",
            "required_controls", "controls_missing",
            "note",
            "passes", "inspections",
        ]

    def get_controls_missing(self, obj) -> list:
        """Назначенный контроль, по которому заключения ещё нет.
        Это то, что попадает в плашку «швы ждут контроля»."""
        required = obj.operation.required_controls or []
        done = {i.method for i in obj.inspections.all()}
        return [m for m in required if m not in done]


class WeldSerializer(serializers.ModelSerializer):
    """Сваренный шов."""

    instance_id = serializers.PrimaryKeyRelatedField(
        source="instance", queryset=PartInstance.objects.all(),
    )
    seam_id = serializers.PrimaryKeyRelatedField(
        source="seam", queryset=SeamSpec.objects.all(),
    )

    part_number = serializers.CharField(source="instance.part.number", read_only=True)
    serial_no = serializers.CharField(source="instance.serial_no", read_only=True)
    seam_number = serializers.CharField(source="seam.number", read_only=True)
    seam_thickness_1 = serializers.DecimalField(
        source="seam.thickness_1", max_digits=7, decimal_places=2, read_only=True,
    )
    seam_thickness_2 = serializers.DecimalField(
        source="seam.thickness_2", max_digits=7, decimal_places=2, read_only=True,
    )
    runs_count = serializers.IntegerField(source="runs.count", read_only=True)

    class Meta:
        model = Weld
        fields = [
            "id",
            "instance_id", "seam_id",
            "part_number", "serial_no", "seam_number", "thickness_1", "thickness_1",
            "status", "runs_count", "created_at",
        ]

    def validate(self, attrs):
        """Шов по чертежу должен принадлежать той же детали,
        что и изделие: иначе на корпус попадёт шов от фланца."""
        instance = attrs.get("instance") or getattr(self.instance, "instance", None)
        seam = attrs.get("seam") or getattr(self.instance, "seam", None)
        if instance and seam and seam.part_id != instance.part_id:
            raise serializers.ValidationError(
                {"seam_id": "Шов принадлежит другой детали"}
            )
        return attrs


class WeldPassportSerializer(WeldSerializer):
    """Паспорт шва — всё, что о нём известно, одним ответом.

    Паспорт не хранится в базе: он собирается из связей. Иначе при
    каждой правке карты пришлось бы пересобирать паспорта.
    """

    operations = OperationRunSerializer(
        source="runs", many=True, read_only=True,
    )
    material_1_marka = serializers.CharField(
        source="seam.material_1.marka", read_only=True, default="",
    )
    material_2_marka = serializers.CharField(
        source="seam.material_2.marka", read_only=True, default="",
    )
    joint_type = serializers.CharField(source="seam.joint_type", read_only=True)
    seam_type = serializers.CharField(source="seam.seam_type", read_only=True)
    seam_length = serializers.DecimalField(
        source="seam.seam_length", max_digits=10, decimal_places=1, read_only=True,
    )
    part_name = serializers.CharField(source="instance.part.name", read_only=True)
    instance_kind = serializers.CharField(source="instance.kind", read_only=True)

    class Meta(WeldSerializer.Meta):
        fields = WeldSerializer.Meta.fields + [
            "part_name", "instance_kind",
            "material_1_marka", "material_2_marka",
            "joint_type", "seam_type", "seam_length",
            "operations",
        ]


class ArcRunSerializer(serializers.ModelSerializer):
    """Участок непрерывного горения дуги."""

    duration = serializers.ReadOnlyField()

    class Meta:
        model = ArcRun
        fields = [
            "id", "session", "pass_run",
            "started_at", "finished_at", "duration",
            "current_avg", "current_min", "current_max",
            "voltage_avg", "pulse_freq",
            "telemetry_complete",
        ]


class WeldingSessionSerializer(serializers.ModelSerializer):
    """Сеанс сварки."""

    equipment_id = serializers.PrimaryKeyRelatedField(
        source="equipment", queryset=Equipment.objects.all(),
    )
    equipment_name = serializers.CharField(source="equipment.name", read_only=True)
    welder_id = serializers.PrimaryKeyRelatedField(
        source="welder", queryset=Welder.objects.all(),
        required=False, allow_null=True,
    )
    operation_run_id = serializers.PrimaryKeyRelatedField(
        source="operation_run", queryset=OperationRun.objects.all(),
        required=False, allow_null=True,
    )
    mode_display = serializers.CharField(source="get_mode_display", read_only=True)
    arcs_count = serializers.IntegerField(source="arcs.count", read_only=True)

    class Meta:
        model = WeldingSession
        fields = [
            "id",
            "equipment_id", "equipment_name",
            "welder_id", "welder_name",
            "mode", "mode_display",
            "operation_run_id", "route_code_raw",
            "started_at", "finished_at",
            "arcs_count",
        ]
        read_only_fields = ["welder_name"]

    def validate(self, attrs):
        """Шов привязывается только к работе по техпроцессу.
        У отработки и прихватки его нет и быть не должно."""
        mode = attrs.get("mode", getattr(self.instance, "mode", "по техпроцессу"))
        run = attrs.get("operation_run")
        if mode != "по техпроцессу" and run:
            raise serializers.ValidationError(
                {"operation_run_id": "Операция указывается только в режиме «по техпроцессу»"}
            )
        return attrs

class RouteCodeSerializer(serializers.ModelSerializer):
    """Соответствие кода с маршрутного листа тому, что варим."""

    part_number = serializers.CharField(source="part.number", read_only=True)
    operation_number = serializers.CharField(source="operation.number", read_only=True)
    seam_number = serializers.CharField(
        source="operation.seam.number", read_only=True,
    )
    card_id = serializers.IntegerField(source="operation.card.id", read_only=True)
    serial_no = serializers.CharField(
        source="instance.serial_no", read_only=True, default="",
    )

    class Meta:
        model = RouteCode
        fields = [
            "id", "code",
            "part", "part_number",
            "operation", "operation_number", "seam_number", "card_id",
            "instance", "serial_no",
            "source", "created_at",
        ]