# Поля с суффиксом _id — записываемые: фронт присылает число.
# Поля без суффикса (number, name) — только чтение: они удобны
# для отображения, но приходят с сервера, а не с фронта.

from rest_framework import serializers

from .models import Operation, Part, SeamSpec
from apps.materials.models import Material


class SeamSpecSerializer(serializers.ModelSerializer):
    """Шов по чертежу."""

    part_id = serializers.PrimaryKeyRelatedField(
        source="part", queryset=Part.objects.all(),
    )
    part_number = serializers.CharField(source="part.number", read_only=True)

    material_1_id = serializers.PrimaryKeyRelatedField(
        source="material_1",  queryset=Material.objects.all(), required=False, allow_null=True,
    )
    material_1_marka = serializers.CharField(
        source="material_1.marka", read_only=True, default="",
    )
    material_2_id = serializers.PrimaryKeyRelatedField(
        source="material_2",  queryset=Material.objects.all(), required=False, allow_null=True,
    )
    material_2_marka = serializers.CharField(
        source="material_2.marka", read_only=True, default="",
    )

    # сколько операций проходит через этот шов: 1 — варится за раз,
    # 2 и больше — корень и заполнение разными картами
    operations_count = serializers.IntegerField(
        source="operations.count", read_only=True,
    )

    class Meta:
        model = SeamSpec
        fields = [
            "id",
            "part_id", "part_number",
            "number", "joint_type",
            "material_1_id", "material_1_marka",
            "material_2_id", "material_2_marka",
            "thickness",
            "seam_type", "seam_diameter", "seam_length",
            "operations_count",
        ]

    def validate(self, attrs):
        """Кольцевой шов без диаметра — сломанный пересчёт скорости
        в картах, которые на него сошлются."""
        seam_type = attrs.get("seam_type", getattr(self.instance, "seam_type", ""))
        diameter = attrs.get("seam_diameter", getattr(self.instance, "seam_diameter", None))
        if seam_type == "кольцевой" and not diameter:
            raise serializers.ValidationError(
                {"seam_diameter": "Для кольцевого шва нужен диаметр"}
            )
        return attrs


class OperationSerializer(serializers.ModelSerializer):
    """Операция техпроцесса. Шов обязателен: по нему портал понимает,
    что именно варится в этой операции."""

    part_id = serializers.PrimaryKeyRelatedField(
        source="part", queryset=Part.objects.all(),
    )
    part_number = serializers.CharField(source="part.number", read_only=True)

    seam_id = serializers.PrimaryKeyRelatedField(
        source="seam", queryset=SeamSpec.objects.all(),
    )
    seam_number = serializers.CharField(source="seam.number", read_only=True)
    seam_thickness = serializers.DecimalField(
        source="seam.thickness", max_digits=7, decimal_places=2, read_only=True,
    )

    # есть ли уже техкарта на эту операцию — видно в списке,
    # чтобы технолог понимал, где дыра
    has_card = serializers.SerializerMethodField()

    class Meta:
        model = Operation
        fields = [
            "id",
            "part_id", "part_number",
            "seam_id", "seam_number", "seam_thickness",
            "number", "name", "order",
            "required_controls",
            "has_card",
        ]

    def get_has_card(self, obj) -> bool:
        # related_name="card" у OneToOneField в WeldingCard;
        # hasattr — потому что при отсутствии связи Django бросает исключение
        return hasattr(obj, "card")

    def validate(self, attrs):
        """Шов должен принадлежать той же детали, что и операция.
        Иначе техпроцесс одной детали сошлётся на шов другой."""
        part = attrs.get("part") or getattr(self.instance, "part", None)
        seam = attrs.get("seam") or getattr(self.instance, "seam", None)
        if part and seam and seam.part_id != part.id:
            raise serializers.ValidationError(
                {"seam_id": "Шов принадлежит другой детали"}
            )
        return attrs


class PartSerializer(serializers.ModelSerializer):
    """Деталь со сводкой: сколько швов и операций заведено."""

    seams_count = serializers.IntegerField(source="seams.count", read_only=True)
    operations_count = serializers.IntegerField(
        source="operations.count", read_only=True,
    )

    class Meta:
        model = Part
        fields = [
            "id", "number", "name", "drawing_no", "note", "is_active",
            "seams_count", "operations_count",
        ]


class PartDetailSerializer(PartSerializer):
    """Полная карточка детали: швы и операции вложенными списками.

    Отдаётся только при запросе одной детали — в списке это было бы
    лишними запросами к базе на каждую строку.
    """

    seams = SeamSpecSerializer(many=True, read_only=True)
    operations = OperationSerializer(many=True, read_only=True)

    class Meta(PartSerializer.Meta):
        fields = PartSerializer.Meta.fields + ["seams", "operations"]