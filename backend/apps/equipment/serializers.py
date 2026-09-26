# apps/equipment/serializers.py

from rest_framework import serializers

from apps.methods.models import WeldingMethod
from apps.workshops.models import Workstation

from .models import Equipment, EquipmentParameter, SpeedUnit


class SpeedUnitSerializer(serializers.ModelSerializer):
    """Единица скорости. Только чтение — заводится через админку."""

    class Meta:
        model = SpeedUnit
        fields = ["id", "code", "name", "is_angular", "to_m_per_h"]


class EquipmentParameterSerializer(serializers.ModelSerializer):
    """Дополнительный параметр установки."""

    class Meta:
        model = EquipmentParameter
        fields = ["id", "code", "name", "unit", "level", "printed", "order"]


class EquipmentSerializer(serializers.ModelSerializer):
    """Установка.

    speed_units и parameters — связи многие-ко-многим, поэтому many=True:
    у УСГА 222 две единицы скорости (м/ч для прямого шва, об/мин для
    кольцевого), у Tetrix одна.

    ВАЖНО: при PATCH эти поля ведут себя жёстко — если поле пришло
    в запросе, старые связи стираются и ставятся присланные. Пустой
    массив обнулит установке единицы скорости, и пересчёт в картах
    перестанет работать. Форма на фронте обязана присылать их целиком.
    """

    method_id = serializers.PrimaryKeyRelatedField(
        source="method", queryset=WeldingMethod.objects.all(),
    )
    method_name = serializers.CharField(source="method.name", read_only=True)
    method_designation = serializers.CharField(
        source="method.designation", read_only=True, default="",
    )

    workstation_id = serializers.PrimaryKeyRelatedField(
        source="workstation", queryset=Workstation.objects.all(),
        allow_null=True, required=False,
    )
    workstation_number = serializers.CharField(
        source="workstation.number", read_only=True, default="",
    )
    workshop_name = serializers.CharField(
        source="workstation.section.workshop.name", read_only=True, default="",
    )
    section_name = serializers.CharField(
        source="workstation.section.name", read_only=True, default="",
    )

    workshop_name = serializers.CharField(
        source="workshop.name", read_only=True, default="",
    )

    speed_units = serializers.PrimaryKeyRelatedField(
        queryset=SpeedUnit.objects.all(), many=True, required=False,
    )
    parameters = serializers.PrimaryKeyRelatedField(
        queryset=EquipmentParameter.objects.all(), many=True, required=False,
    )

    class Meta:
        model = Equipment
        fields = [
            "id", "name",
            "method_id", "method_name", "method_designation",
            "workstation_id", "workstation_number",
            "section_name", "workshop_name",
            "node_id", "node_ip",
            "speed_units", "parameters",
            "has_pulse", "is_active",
        ]

    def validate_speed_units(self, value):
        """Угловая единица без линейной — подозрительно: на любой
        установке бывают прямые швы, и для них нужны м/ч или мм/с."""
        if value and all(u.is_angular for u in value):
            raise serializers.ValidationError(
                "Заданы только угловые единицы. Для прямых швов нужна линейная"
            )
        return value


class EquipmentDetailSerializer(EquipmentSerializer):
    """Карточка установки: единицы и параметры разворачиваются целиком,
    чтобы фронт не ходил за справочниками отдельно."""

    speed_units_detail = SpeedUnitSerializer(
        source="speed_units", many=True, read_only=True,
    )
    parameters_detail = EquipmentParameterSerializer(
        source="parameters", many=True, read_only=True,
    )

    class Meta(EquipmentSerializer.Meta):
        fields = EquipmentSerializer.Meta.fields + [
            "speed_units_detail", "parameters_detail",
        ]