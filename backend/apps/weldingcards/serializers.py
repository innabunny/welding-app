from rest_framework import serializers

from apps.equipment.models import Equipment, SpeedUnit
from apps.materials.models import FillerMaterial, GasFlux
from apps.methods.models import WeldingMethod
from apps.technology.models import Operation

from .models import WeldingCard, WeldPass


class WeldPassSerializer(serializers.ModelSerializer):
    """Проход — план режима.

    speed_min/max не принимаются с фронта: их считает save() модели
    из введённой скорости, единицы установки и диаметра шва.
    Если разрешить их писать, придёт одно значение, а сохранится
    пересчитанное, и никто не поймёт почему.
    """

    speed_unit_id = serializers.PrimaryKeyRelatedField(
        source="speed_unit", queryset=SpeedUnit.objects.all(),
        required=False, allow_null=True,
    )
    speed_unit_name = serializers.CharField(
        source="speed_unit.name", read_only=True, default="",
    )
    filler_id = serializers.PrimaryKeyRelatedField(
        source="filler", queryset=FillerMaterial.objects.all(),
        required=False, allow_null=True,
    )

    class Meta:
        model = WeldPass
        fields = [
            "id", "no",
            "current_min", "current_max",
            "voltage_min", "voltage_max",
            "speed_unit_id", "speed_unit_name",
            "speed_raw_min", "speed_raw_max",
            "speed_min", "speed_max", "speed_required",
            "wire_speed_min", "wire_speed_max",
            "gas_flow_min", "gas_flow_max",
            "backing_flow_min", "backing_flow_max",
            "plasma_flow_min", "plasma_flow_max",
            "filler_id", "filler_text", "filler_diameter",
            "pulse_current", "pulse_time", "pause_current", "pause_time",
            "beam_current",
            "extra",
        ]
        read_only_fields = ["speed_min", "speed_max", "filler_text"]

    def validate(self, attrs):
        """«От» не должно быть больше «до» — иначе статистика режимов
        поедет молча."""
        pairs = [
            ("current_min", "current_max", "ток"),
            ("voltage_min", "voltage_max", "напряжение"),
            ("speed_raw_min", "speed_raw_max", "скорость"),
            ("wire_speed_min", "wire_speed_max", "подача проволоки"),
            ("gas_flow_min", "gas_flow_max", "расход защитного газа"),
            ("backing_flow_min", "backing_flow_max", "расход газа на поддув"),
            ("plasma_flow_min", "plasma_flow_max", "расход плазмообразующего"),
        ]
        for lo, hi, label in pairs:
            a, b = attrs.get(lo), attrs.get(hi)
            if a is not None and b is not None and a > b:
                raise serializers.ValidationError(
                    {hi: f"Значение «до» меньше «от» ({label})"}
                )
        return attrs


class WeldingCardSerializer(serializers.ModelSerializer):
    """Полная карта со вложенными проходами — для формы технолога.

    Деталь, номер операции, шов и его материалы НЕ хранятся в карте:
    они достаются по цепочке operation → part / seam и отдаются
    только на чтение.
    """

    passes = WeldPassSerializer(many=True, required=False)

    operation_id = serializers.PrimaryKeyRelatedField(
        source="operation", queryset=Operation.objects.all(),
    )
    # всё, что ниже, приходит по цепочке и на фронт уходит только для показа
    operation_number = serializers.CharField(
        source="operation.number", read_only=True,
    )
    part_number = serializers.CharField(
        source="operation.part.number", read_only=True,
    )
    part_name = serializers.CharField(
        source="operation.part.name", read_only=True,
    )
    seam_number = serializers.CharField(
        source="operation.seam.number", read_only=True,
    )
    seam_thickness = serializers.DecimalField(
        source="operation.seam.thickness",
        max_digits=7, decimal_places=2, read_only=True,
    )
    seam_type = serializers.CharField(
        source="operation.seam.seam_type", read_only=True, default="",
    )
    seam_diameter = serializers.DecimalField(
        source="operation.seam.seam_diameter",
        max_digits=9, decimal_places=2, read_only=True,
    )
    material_1_marka = serializers.CharField(
        source="operation.seam.material_1.marka", read_only=True, default="",
    )
    material_2_marka = serializers.CharField(
        source="operation.seam.material_2.marka", read_only=True, default="",
    )

    method_id = serializers.PrimaryKeyRelatedField(
        source="method", queryset=WeldingMethod.objects.all(),
    )
    method_name = serializers.CharField(source="method.name", read_only=True)
    method_process = serializers.CharField(source="method.process", read_only=True)
    method_tpl_key = serializers.CharField(
        source="method.tpl_key", read_only=True, default="",
    )

    equipment_id = serializers.PrimaryKeyRelatedField(
        source="equipment", queryset=Equipment.objects.all(),
        required=False, allow_null=True,
    )
    equipment_name = serializers.CharField(
        source="equipment.name", read_only=True, default="",
    )

    tungsten_id = serializers.PrimaryKeyRelatedField(
        source="tungsten",
        queryset=FillerMaterial.objects.filter(kind="вольфрам"),
        required=False, allow_null=True,
    )
    filler_id = serializers.PrimaryKeyRelatedField(
        source="filler", queryset=FillerMaterial.objects.all(),
        required=False, allow_null=True,
    )
    shield_gas_id = serializers.PrimaryKeyRelatedField(
        source="shield_gas", queryset=GasFlux.objects.filter(kind="gas"),
        required=False, allow_null=True,
    )
    backing_gas_id = serializers.PrimaryKeyRelatedField(
        source="backing_gas", queryset=GasFlux.objects.filter(kind="gas"),
        required=False, allow_null=True,
    )
    plasma_gas_id = serializers.PrimaryKeyRelatedField(
        source="plasma_gas", queryset=GasFlux.objects.filter(kind="gas"),
        required=False, allow_null=True,
    )
    flux_id = serializers.PrimaryKeyRelatedField(
        source="flux", queryset=GasFlux.objects.filter(kind="flux"),
        required=False, allow_null=True,
    )

    designation = serializers.ReadOnlyField()

    class Meta:
        model = WeldingCard
        fields = [
            "id", "card_no", "revision",
            # к чему относится — только чтение, кроме самой связи
            "operation_id", "operation_number",
            "part_number", "part_name",
            "seam_number", "seam_thickness", "seam_type", "seam_diameter",
            "material_1_marka", "material_2_marka",
            # технология
            "method_id", "method_name", "method_process", "method_tpl_key",
            "designation",
            "equipment_id", "equipment_name",
            "welding_mode",
            # сварочные материалы
            "tungsten_id", "tungsten_text",
            "filler_id", "filler_text",
            "shield_gas_id", "shield_gas_text",
            "backing_gas_id", "backing_gas_text",
            "plasma_gas_id", "plasma_gas_text",
            "flux_id", "flux_text",
            "plasma_nozzle_d",
            # условия и разделка
            "heat_treatment",
            "groove_type", "groove_angle", "groove_gap", "groove_root",
            "groove_cap", "groove_root_cap", "groove_width", "groove_svg",
            "extra",
            "passes",
            # служебное
            "is_released",
            "author_name", "created_at", "updated_at",
        ]
        read_only_fields = [
            "tungsten_text", "filler_text", "shield_gas_text",
            "backing_gas_text", "plasma_gas_text", "flux_text",
            "author_name", "created_at", "updated_at",
        ]

    def validate(self, attrs):
        """Импульсный режим — только на установке, которая его умеет."""
        equipment = attrs.get("equipment") or getattr(self.instance, "equipment", None)
        mode = attrs.get("welding_mode") or getattr(self.instance, "welding_mode", "")
        if mode == "импульсный" and equipment and not equipment.has_pulse:
            raise serializers.ValidationError(
                {"welding_mode": f"У установки «{equipment.name}» нет импульсного режима"}
            )
        return attrs

    def create(self, validated_data):
        passes_data = validated_data.pop("passes", [])
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["author"] = request.user
        card = WeldingCard.objects.create(**validated_data)
        self._save_passes(card, passes_data)
        return card

    def update(self, instance, validated_data):
        # выпущенная карта — документ, по ней уже варят.
        # Правки только через новую редакцию
        if instance.is_released and not validated_data.get("is_released") is False:
            if any(k != "is_released" for k in validated_data):
                raise serializers.ValidationError(
                    "Выпущенную карту править нельзя. Снимите отметку «выпущена» "
                    "или создайте новую редакцию"
                )

        passes_data = validated_data.pop("passes", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # проходы пересобираем целиком — их единицы, а порядок важен
        if passes_data is not None:
            instance.passes.all().delete()
            self._save_passes(instance, passes_data)

        return instance

    @staticmethod
    def _save_passes(card, passes_data):
        """Создаём по одному, чтобы сработал save() модели: там
        считается скорость в м/ч и снимок присадки.
        bulk_create этот код НЕ вызывает."""
        for p in passes_data:
            p.pop("id", None)
            WeldPass(card=card, **p).save()


class WeldingCardListSerializer(serializers.ModelSerializer):
    """Короткий вид для списка и результатов поиска."""

    part_number = serializers.CharField(source="operation.part.number", read_only=True)
    part_name = serializers.CharField(source="operation.part.name", read_only=True)
    operation_number = serializers.CharField(source="operation.number", read_only=True)
    seam_number = serializers.CharField(source="operation.seam.number", read_only=True)
    seam_thickness = serializers.DecimalField(
        source="operation.seam.thickness",
        max_digits=7, decimal_places=2, read_only=True,
    )
    material_1_marka = serializers.CharField(
        source="operation.seam.material_1.marka", read_only=True, default="",
    )
    material_2_marka = serializers.CharField(
        source="operation.seam.material_2.marka", read_only=True, default="",
    )
    method_name = serializers.CharField(source="method.name", read_only=True)
    equipment_name = serializers.CharField(
        source="equipment.name", read_only=True, default="",
    )
    passes_count = serializers.IntegerField(source="passes.count", read_only=True)

    class Meta:
        model = WeldingCard
        fields = [
            "id", "card_no", "revision",
            "part_number", "part_name", "operation_number",
            "seam_number", "seam_thickness",
            "material_1_marka", "material_2_marka",
            "method_name", "equipment_name",
            "passes_count", "is_released",
            "author_name", "created_at",
        ]