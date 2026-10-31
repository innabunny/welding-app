from django.utils import timezone
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
    NodeOutage,
    NodeState,
    Deviation,
    WeldDecision,

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
        # min/max у сегмента могут не прийти — без default() упадёт на пустом
        return {
            "avg": round(sum(values) / len(values), 1),
            "min": min((float(a.current_min) for a in arcs if a.current_min is not None), default=None),
            "max": max((float(a.current_max) for a in arcs if a.current_max is not None), default=None),
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
            "part_number", "serial_no", "seam_number", "seam_thickness_1", "seam_thickness_2",
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
    """Участок непрерывного горения дуги.

    К какому проходу относится участок, решает разбор после сеанса.
    Поэтому рядом с номером прохода отдаётся match_source: как
    определена граница — датчиком, скачком тока или только расчётом
    по времени. Это разная достоверность, пользователь должен её видеть.
    Допуски прохода берутся из pass_plan сеанса по planned_pass_id,
    чтобы одни и те же цифры не приходили в двух местах.
    """

    # число секунд, как durationSeconds у отклонений. С десятыми:
    # прихватка длится доли секунды, целое число дало бы ноль
    duration_seconds = serializers.SerializerMethodField()

    pass_no = serializers.IntegerField(source="pass_run.no", read_only=True, default=None)
    planned_pass_id = serializers.IntegerField(
        source="pass_run.planned_pass_id", read_only=True, default=None,
    )
    match_source = serializers.CharField(
        source="pass_run.match_source", read_only=True, default="",
    )
    match_source_display = serializers.CharField(
        source="pass_run.get_match_source_display", read_only=True, default="",
    )

    class Meta:
        model = ArcRun
        fields = [
            "id", "session", "pass_run",
            "pass_no", "planned_pass_id", "match_source", "match_source_display",
            "started_at", "finished_at", "duration_seconds",
            "current_avg", "current_min", "current_max",
            "voltage_avg", "pulse_freq",
            "telemetry_complete",
        ]

    def get_duration_seconds(self, obj) -> float | None:
        d = obj.duration
        return round(d.total_seconds(), 1) if d is not None else None


class PassPlanSerializer(serializers.ModelSerializer):
    """Проход по техкарте: допуски, с которыми сверяется телеметрия.

    Числа — строками, как все DecimalField в API. Скорость — уже
    пересчитанная в м/ч (speed_min/max), а не в единицах установки.
    """

    class Meta:
        model = WeldPass
        fields = [
            "id", "no",
            "current_min", "current_max",
            "voltage_min", "voltage_max",
            "speed_min", "speed_max", "speed_required",
            "wire_speed_min", "wire_speed_max",
            "gas_flow_min", "gas_flow_max",
            "backing_flow_min", "backing_flow_max",
            "pulse_current", "pause_current",
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

    # Что варили — только у сварки по техпроцессу. У отработки
    # и прихватки операции нет, поля приходят пустыми
    card_id = serializers.IntegerField(source="operation_run.card_id", read_only=True, default=None)
    card_no = serializers.CharField(source="operation_run.card.card_no", read_only=True, default="")
    part_number = serializers.CharField(
        source="operation_run.weld.instance.part.number", read_only=True, default="",
    )
    serial_no = serializers.CharField(
        source="operation_run.weld.instance.serial_no", read_only=True, default="",
    )
    seam_number = serializers.CharField(
        source="operation_run.weld.seam.number", read_only=True, default="",
    )
    operation_number = serializers.CharField(
        source="operation_run.operation.number", read_only=True, default="",
    )

    # Допуски по проходам из карты, по которой реально варили
    # (OperationRun.card, а не текущая карта операции: её могли
    # переиздать). Пустой список — сварка без техкарты, режим
    # не контролируется
    pass_plan = serializers.SerializerMethodField()

    # Проход по карте у участка дуги, который горит прямо сейчас.
    # Обычно null даже во время сварки: проходы участкам назначает
    # разбор после закрытия сеанса. Известен заранее, только если
    # границу указал человек или датчик. Фронт по нему выбирает
    # коридор допуска для подсветки живых значений
    current_planned_pass_id = serializers.SerializerMethodField()

    # Разряд берётся из справочника сварщиков, а не снимком: нужен
    # списку «Оборудование в работе», то есть про идущий сеанс
    welder_rank = serializers.CharField(source="welder.rank", read_only=True, default="")

    # Суммарное время горения дуги за сеанс, секунды. У горящего
    # участка считается до момента ответа
    arc_seconds = serializers.SerializerMethodField()

    # Сколько отклонений нашёл разбор в этом сеансе — для пометки
    # «было отклонение». Решены они или нет, здесь не важно
    deviations_count = serializers.IntegerField(source="deviations.count", read_only=True)

    # Последний проход, к которому отнесены участки дуги, и средние
    # ток и напряжение по нему, взвешенные по длительности участков.
    # null — ни один участок ещё не отнесён к проходу
    current_pass = serializers.SerializerMethodField()

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
            "card_id", "card_no", "part_number", "serial_no",
            "seam_number", "operation_number",
            "pass_plan", "current_planned_pass_id",
            "welder_rank", "arc_seconds", "deviations_count", "current_pass",
        ]
        read_only_fields = ["welder_name"]

    @staticmethod
    def _arc_seconds(arc, now) -> float:
        end = arc.finished_at or now
        return max(0.0, (end - arc.started_at).total_seconds())

    def get_arc_seconds(self, obj) -> int:
        now = timezone.now()
        return round(sum(self._arc_seconds(a, now) for a in obj.arcs.all()))

    def get_current_pass(self, obj) -> dict | None:
        assigned = [a for a in obj.arcs.all() if a.pass_run is not None]
        if not assigned:
            return None
        pass_run = max(assigned, key=lambda a: a.started_at).pass_run
        now = timezone.now()

        def weighted(field):
            total = weight = 0.0
            for a in assigned:
                value = getattr(a, field)
                if a.pass_run_id != pass_run.id or value is None:
                    continue
                w = self._arc_seconds(a, now)
                total += float(value) * w
                weight += w
            return round(total / weight, 1) if weight else None

        run = obj.operation_run
        planned = len(run.card.passes.all()) if run is not None and run.card_id is not None else None
        return {
            "no": pass_run.no,
            "total": planned,
            "current_avg": weighted("current_avg"),
            "voltage_avg": weighted("voltage_avg"),
        }

    def get_current_planned_pass_id(self, obj) -> int | None:
        # arcs уже загружены prefetch'ем вместе с pass_run — без лишних запросов
        burning = [a for a in obj.arcs.all() if a.finished_at is None and a.pass_run is not None]
        if not burning:
            return None
        return max(burning, key=lambda a: a.started_at).pass_run.planned_pass_id

    def get_pass_plan(self, obj) -> list:
        run = obj.operation_run
        if run is None or run.card_id is None:
            return []
        return PassPlanSerializer(run.card.passes.all(), many=True).data

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

class NodeOutageSerializer(serializers.ModelSerializer):
    duration_seconds = serializers.IntegerField(read_only=True)
    kind_name = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = NodeOutage
        fields = [
            "id", "started_at", "finished_at",
            "kind", "kind_name", "duration_seconds",
        ]


class NodeStateSerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(
        source="equipment.name", read_only=True, default=""
    )
    workshop_name = serializers.CharField(
        source="equipment.workshop.name", read_only=True, default=""
    )
    # сколько секунд назад было последнее сообщение — фронту так
    # удобнее, чем вычитать даты и ловить разницу часовых поясов
    silent_seconds = serializers.SerializerMethodField()
    # Кто последним работал на аппарате и когда начал — для списка
    # узлов без связи. Имя — снимок из сеанса, не из справочника
    last_session = serializers.SerializerMethodField()

    class Meta:
        model = NodeState
        fields = [
            "id", "node_id", "equipment", "equipment_name", "workshop_name",
            "is_online", "last_seen_at", "last_status_at", "silent_seconds",
            "queued", "ip", "firmware", "uptime_seconds", "free_bytes",
            "temperature", "reset_reason", "last_session",
        ]

    def get_last_session(self, obj) -> dict | None:
        if obj.equipment_id is None:
            return None
        last = obj.equipment.sessions.order_by("-started_at").only("welder_name", "started_at").first()
        if last is None:
            return None
        return {"welder_name": last.welder_name, "started_at": last.started_at}

    def get_silent_seconds(self, obj) -> int | None:
        if obj.last_seen_at is None:
            return None
        from django.utils import timezone

        return int((timezone.now() - obj.last_seen_at).total_seconds())        


class DeviationSerializer(serializers.ModelSerializer):
    """Отклонение от режима. Только чтение: записи создаёт разбор.
 
    Пути вроде session.equipment.name длинные, зато не требуют
    лишних запросов — вьюсет подтягивает всё через select_related.
    """
 
    parameter_name = serializers.CharField(
        source="get_parameter_display", read_only=True
    )
    severity_name = serializers.CharField(
        source="get_severity_display", read_only=True
    )
    is_organizational = serializers.BooleanField(read_only=True)
 
    equipment_name = serializers.CharField(
        source="session.equipment.name", read_only=True, default=""
    )
    # снимок фамилии: сварщик мог уволиться
    welder_name = serializers.CharField(
        source="session.welder_name", read_only=True, default=""
    )
    mode = serializers.CharField(source="session.mode", read_only=True, default="")
 
    # цепочка до детали есть только у сварки по техпроцессу
    part_number = serializers.CharField(
        source="pass_run.run.weld.instance.part.number",
        read_only=True, default="",
    )
    serial_no = serializers.CharField(
        source="pass_run.run.weld.instance.serial_no",
        read_only=True, default="",
    )
    seam_number = serializers.CharField(
        source="pass_run.run.weld.seam.number", read_only=True, default=""
    )
    operation_number = serializers.CharField(
        source="pass_run.run.operation.number", read_only=True, default=""
    )
    pass_no = serializers.IntegerField(
        source="pass_run.no", read_only=True, default=None
    )
    # нужен фронту, чтобы было куда отправлять решение
    weld_id = serializers.IntegerField(
        source="pass_run.run.weld_id", read_only=True, default=None
    )
    run_id = serializers.IntegerField(
        source="pass_run.run_id", read_only=True, default=None
    )
 
    duration_seconds = serializers.SerializerMethodField()
    # куда и на сколько вышли за допуск, в единицах параметра (А, В…).
    # Считается здесь, а не на фронте: отклонения — дело бэкенда
    direction = serializers.SerializerMethodField()
    delta = serializers.SerializerMethodField()
 
    class Meta:
        model = Deviation
        fields = [
            "id", "session", "pass_run",
            "parameter", "parameter_name", "severity", "severity_name",
            "is_organizational",
            "planned_min", "planned_max", "actual_value", "deviation_percent",
            "started_at", "finished_at", "duration_seconds",
            "reviewed",
            "equipment_name", "welder_name", "mode",
            "part_number", "serial_no", "seam_number", "operation_number",
            "pass_no", "weld_id", "run_id",
            "direction", "delta",
        ]

    def get_direction(self, obj) -> str | None:
        """'above' — выше верхней границы, 'below' — ниже нижней.

        None у нарушений порядка: там нет ни значения, ни допуска.
        """
        if obj.actual_value is None:
            return None
        if obj.planned_max is not None and obj.actual_value > obj.planned_max:
            return "above"
        if obj.planned_min is not None and obj.actual_value < obj.planned_min:
            return "below"
        return None

    def get_delta(self, obj) -> str | None:
        """На сколько вышли за границу. Строкой, как все десятичные в API."""
        direction = self.get_direction(obj)
        if direction == "above":
            return str(obj.actual_value - obj.planned_max)
        if direction == "below":
            return str(obj.planned_min - obj.actual_value)
        return None
 
    def get_duration_seconds(self, obj) -> int | None:
        """DurationField приходит строкой вида '00:00:12'.
 
        Фронту удобнее число: форматировать и сравнивать проще,
        чем разбирать строку.
        """
        return int(obj.duration.total_seconds()) if obj.duration else None
 
 
class WeldDecisionSerializer(serializers.ModelSerializer):
    result_name = serializers.CharField(source="get_result_display", read_only=True)
 
    equipment_name = serializers.CharField(
        source="session.equipment.name", read_only=True, default=""
    )
    part_number = serializers.CharField(
        source="weld.instance.part.number", read_only=True, default=""
    )
    serial_no = serializers.CharField(
        source="weld.instance.serial_no", read_only=True, default=""
    )
    seam_number = serializers.CharField(
        source="weld.seam.number", read_only=True, default=""
    )
    operation_number = serializers.CharField(
        source="run.operation.number", read_only=True, default=""
    )
 
    class Meta:
        model = WeldDecision
        fields = [
            "id", "session", "weld", "run",
            "result", "result_name", "deviations",
            "author", "author_name", "created_at",
            "reason", "assigned_control",
            "equipment_name", "part_number", "serial_no",
            "seam_number", "operation_number",
        ]
        # автора и подпись ставит сервер: нельзя подписаться за другого
        read_only_fields = ["author", "author_name", "created_at"]
 
    def validate(self, attrs):
        """Проверки, которые нельзя выразить полями.
 
        Первая: отклонения должны относиться к тому же сеансу.
        Иначе можно закрыть решением по одному шву отклонения
        с другого аппарата — случайно или нарочно.
        """
        session = attrs.get("session") or getattr(self.instance, "session", None)
        deviations = attrs.get("deviations")
 
        if session and deviations:
            foreign = [d.id for d in deviations if d.session_id != session.id]
            if foreign:
                raise serializers.ValidationError({
                    "deviations": f"Отклонения из другого сеанса: {foreign}"
                })
 
        # Решение должно подходить к виду отклонений. Отклонение режима
        # допускают, отправляют на контроль или на переварку; нарушение
        # порядка только разбирают. Смешивать виды в одном решении нельзя
        result = attrs.get("result") or getattr(self.instance, "result", None)
        if deviations and result:
            organizational = {d.is_organizational for d in deviations}
            if len(organizational) > 1:
                raise serializers.ValidationError({
                    "deviations": "Отклонения режима и нарушения порядка решаются отдельно"
                })
            is_order = organizational.pop()
            if is_order and result != WeldDecision.Result.HANDLED:
                raise serializers.ValidationError({
                    "result": "Нарушение порядка можно только разобрать"
                })
            if not is_order and result == WeldDecision.Result.HANDLED:
                raise serializers.ValidationError({
                    "result": "Отклонение режима допускают, отправляют на контроль или на переварку"
                })

        # Мастер разбирает нарушения порядка, а судьбу шва по режиму
        # решает технолог
        request = self.context.get("request")
        role = getattr(getattr(request, "user", None), "role", None)
        if role == "master" and result != WeldDecision.Result.HANDLED:
            raise serializers.ValidationError({
                "result": "Решение по отклонению режима принимает технолог"
            })

        # Вторая: «на контроль» без указания метода бессмысленно —
        # непонятно, что назначили
        control = attrs.get("assigned_control", "")
        if result == "на контроль" and not control.strip():
            raise serializers.ValidationError({
                "assigned_control": "Укажите вид контроля: РК, УЗК, ВИК"
            })
 
        return attrs
 