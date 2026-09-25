from rest_framework import serializers

from apps.materials.models import FillerMaterial, GasFlux, Material, MaterialGroup
from apps.methods.models import WeldingMethod
from apps.welders.models import Welder

from .models import Attestation, AttestationItem, AttestationRule


class AttestationRuleSerializer(serializers.ModelSerializer):
    """Библиотека правил: способ + группа + диапазон толщины → какие
    результаты испытаний обязательны (поля протокола 18-24) и сколько
    образцов. Пока только справочник, в форму не подставляется."""

    method_id = serializers.PrimaryKeyRelatedField(
        source="method", queryset=WeldingMethod.objects.all(),
    )
    method_name = serializers.CharField(source="method.name", read_only=True)
    group_id = serializers.PrimaryKeyRelatedField(
        source="group", queryset=MaterialGroup.objects.all(),
    )
    group_code = serializers.CharField(source="group.code", read_only=True)

    class Meta:
        model = AttestationRule
        fields = [
            "id",
            "method_id", "method_name",
            "group_id", "group_code",
            "th_from", "th_to",
            "required_output", "is_active",
        ]


class AttestationItemSerializer(serializers.ModelSerializer):
    """Образец аттестации — пара материалов, на которой варят пробу.

    ВНИМАНИЕ на имена полей материалов. Мост camelCase ломается на
    стыке буквы и цифры: material1Id он превращает в material_1_id,
    а не в material1_id. Поэтому поля названы material_1 / material_2
    с source на реальные material1 / material2 модели — тогда фронт
    шлёт material1 / material2 и ничего не корёжится.
    """

    material_1 = serializers.PrimaryKeyRelatedField(
        source="material1", queryset=Material.objects.all(),
    )
    material_1_marka = serializers.CharField(
        source="material1.marka", read_only=True, default="",
    )
    material_2 = serializers.PrimaryKeyRelatedField(
        source="material2", queryset=Material.objects.all(),
        required=False, allow_null=True,
    )
    material_2_marka = serializers.CharField(
        source="material2.marka", read_only=True, default="",
    )

    wire_id = serializers.PrimaryKeyRelatedField(
        source="wire", queryset=FillerMaterial.objects.all(),
        required=False, allow_null=True,
    )
    flux_id = serializers.PrimaryKeyRelatedField(
        source="flux", queryset=GasFlux.objects.filter(kind="flux"),
        required=False, allow_null=True,
    )
    gas_id = serializers.PrimaryKeyRelatedField(
        source="gas", queryset=GasFlux.objects.filter(kind="gas"),
        required=False, allow_null=True,
    )

    class Meta:
        model = AttestationItem
        fields = [
            "id", "sample_no",
            "material_1", "material_1_marka",
            "material_2", "material_2_marka",
            "uniform",
            "thickness_min", "thickness_max",
            "wire_id", "wire_text",
            "flux_id", "flux_text",
            "gas_id", "gas_text",
            "position", "preheat", "heat_treatment",
        ]
        # снимки заполняет save() модели, фронт их не шлёт
        read_only_fields = ["wire_text", "flux_text", "gas_text"]

    def validate(self, attrs):
        lo = attrs.get("thickness_min")
        hi = attrs.get("thickness_max")
        if lo is not None and hi is not None and lo > hi:
            raise serializers.ValidationError(
                {"thickness_max": "Толщина «до» меньше, чем «от»"}
            )

        # при однородном соединении вторая марка не заполняется:
        # пустое поле и означает «варили одну марку»
        if attrs.get("uniform") and attrs.get("material2"):
            attrs["material2"] = None

        return attrs


class AttestationSerializer(serializers.ModelSerializer):
    """Аттестация со списком образцов."""

    items = AttestationItemSerializer(many=True)

    welder_id = serializers.PrimaryKeyRelatedField(
        source="welder", queryset=Welder.objects.all(),
    )
    welder_fio = serializers.CharField(source="welder.fio", read_only=True)
    welder_workshop = serializers.CharField(
        source="welder.workshop.name", read_only=True, default="",
    )

    method_id = serializers.PrimaryKeyRelatedField(
        source="method", queryset=WeldingMethod.objects.all(),
    )
    method_name = serializers.CharField(source="method.name", read_only=True)

    group_id = serializers.PrimaryKeyRelatedField(
        source="group", queryset=MaterialGroup.objects.all(),
    )
    group_code = serializers.CharField(source="group.code", read_only=True)

    # состояние срока для цветной плашки в реестре: valid / soon / expired
    expiry_state = serializers.ReadOnlyField()
    status_display = serializers.CharField(
        source="get_status_display", read_only=True,
    )

    class Meta:
        model = Attestation
        fields = [
            "id",
            "welder_id", "welder_fio", "welder_workshop",
            "method_id", "method_name",
            "group_id", "group_code",
            "kind", "controls",
            "status", "status_display",
            "attested_at", "valid_until", "expiry_state",
            "protocol_no", "certificate_no",
            "created_at",
            "items",
        ]
        read_only_fields = ["valid_until", "created_at"]

    def create(self, validated_data):
        """Вложенные объекты DRF сам не создаёт — вынимаем образцы
        и создаём по одному, чтобы сработал save() модели со снимками."""
        items_data = validated_data.pop("items", [])
        attestation = Attestation.objects.create(**validated_data)
        for item in items_data:
            AttestationItem(attestation=attestation, **item).save()
        return attestation

    def update(self, instance, validated_data):
        # править можно только черновик: у отправленной на испытания
        # аттестации документы уже ушли, менять их нельзя
        if instance.status != "draft":
            raise serializers.ValidationError(
                "Редактировать можно только черновик"
            )

        items_data = validated_data.pop("items", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # образцы пересобираем целиком — их единицы, а порядок важен
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                item.pop("id", None)
                AttestationItem(attestation=instance, **item).save()

        return instance


class AttestationListSerializer(serializers.ModelSerializer):
    """Короткий вид для реестра."""

    welder_fio = serializers.CharField(source="welder.fio", read_only=True)
    welder_workshop = serializers.CharField(
        source="welder.workshop.name", read_only=True, default="",
    )
    method_name = serializers.CharField(source="method.name", read_only=True)
    group_code = serializers.CharField(source="group.code", read_only=True)
    expiry_state = serializers.ReadOnlyField()
    status_display = serializers.CharField(
        source="get_status_display", read_only=True,
    )
    items_count = serializers.IntegerField(source="items.count", read_only=True)

    class Meta:
        model = Attestation
        fields = [
            "id",
            "welder_fio", "welder_workshop",
            "method_name", "group_code",
            "kind", "status", "status_display",
            "attested_at", "valid_until", "expiry_state",
            "protocol_no", "certificate_no",
            "items_count", "created_at",
        ]