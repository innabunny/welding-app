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

    

    # записываемый id: по нему образец обновляется на месте, а не пересоздаётся
    id = serializers.IntegerField(required=False)

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
            "vik_result", "physical_protocol", "metallography_protocol",
            "tensile_strength", "bend_angle", "impact_strength", "other_methods",
            "requirements_snapshot",
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
            "practical_eval", "conclusion",
            "chairman", "head_shop", "head_btk",
            "items",
        ]
        read_only_fields = ["valid_until", "created_at"]

    def create(self, validated_data):
        """Вложенные объекты DRF сам не создаёт — вынимаем образцы
        и создаём по одному, чтобы сработал save() модели со снимками."""
        items_data = validated_data.pop("items", [])
        attestation = Attestation.objects.create(**validated_data)
        for item in items_data:
            item.pop("id", None)
            AttestationItem(attestation=attestation, **item).save()
        return attestation

    def validate(self, attrs):
        status = attrs.get("status", getattr(self.instance, "status", "draft"))
        attested_at = attrs.get("attested_at", getattr(self.instance, "attested_at", None))
        if status == "done" and not attested_at:
            raise serializers.ValidationError(
                {"attested_at": "Для статуса «Аттестован» нужна дата аттестации"}
            )
        return attrs

    def update(self, instance, validated_data):
        # в черновике правится всё; после отправки на испытания —
        # только результаты, статус и реквизиты протокола
        if instance.status != "draft":
            phase2 = {
                "status", "attested_at", "protocol_no", "certificate_no",
                "practical_eval", "conclusion",
                "chairman", "head_shop", "head_btk", "items",
            }
            forbidden = set(validated_data) - phase2
            if forbidden:
                raise serializers.ValidationError(
                    f"После отправки на испытания нельзя менять: "
                    f"{', '.join(sorted(forbidden))}"
                )

        items_data = validated_data.pop("items", None)
        leaving_draft = instance.status == "draft" and validated_data.get("status", "draft") != "draft"

        # срок считает save() модели, только если он пуст
        if "attested_at" in validated_data:
            instance.valid_until = None
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            self._save_items(instance, items_data, draft=instance.status == "draft" or leaving_draft)
        if leaving_draft:
            self._snapshot_requirements(instance)
        return instance

    # после испытаний меняются только результаты образцов
    RESULT_FIELDS = {
        "vik_result", "physical_protocol", "metallography_protocol",
        "tensile_strength", "bend_angle", "impact_strength", "other_methods",
    }

    def _save_items(self, instance, items_data, draft):
        existing = {item.id: item for item in instance.items.all()}
        keep = set()
        for data in items_data:
            item = existing.get(data.pop("id", None))
            if not draft:
                if item is None:
                    raise serializers.ValidationError(
                        "После отправки на испытания образцы не добавляются"
                    )
                data = {k: v for k, v in data.items() if k in self.RESULT_FIELDS}
            if item is None:
                item = AttestationItem(attestation=instance)
            # сменили материал в черновике — снимок подписи снимаем заново
            for fk, snap in (("wire", "wire_text"), ("flux", "flux_text"), ("gas", "gas_text")):
                if fk in data and getattr(item, f"{fk}_id") != getattr(data[fk], "id", None):
                    setattr(item, snap, "")
            for attr, value in data.items():
                setattr(item, attr, value)
            item.save()
            keep.add(item.id)
        if draft:
            instance.items.exclude(id__in=keep).delete()

    @staticmethod
    def _snapshot_requirements(instance):
        """Требования фиксируются при отправке на испытания:
        правило в библиотеке могут поменять, а протокол — нет."""
        rules = AttestationRule.objects.filter(
            method=instance.method, group=instance.group, is_active=True,
        )
        for item in instance.items.all():
            if item.requirements_snapshot:
                continue
            thickness = item.thickness_max or item.thickness_min
            if thickness is None:
                continue
            rule = next(
                (r for r in rules
                 if r.th_from <= thickness and (r.th_to is None or thickness <= r.th_to)),
                None,
            )
            if rule:
                item.requirements_snapshot = rule.required_output
                item.save(update_fields=["requirements_snapshot"])


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