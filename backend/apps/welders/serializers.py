from rest_framework import serializers

from apps.workshops.models import Workshop

from .models import Welder


class WelderSerializer(serializers.ModelSerializer):
    """Карточка сварщика.

    age и experience_years считает модель из дат рождения и начала
    стажа — хранить их числами нельзя, они устареют на следующий год.
    """

    workshop_id = serializers.PrimaryKeyRelatedField(
        source="workshop", queryset=Workshop.objects.all(),
        required=False, allow_null=True,
    )
    workshop_name = serializers.CharField(
        source="workshop.name", read_only=True, default="",
    )

    age = serializers.ReadOnlyField()
    experience_years = serializers.ReadOnlyField()

    class Meta:
        model = Welder
        fields = [
            "id", "fio", "personnel_no",
            "birth_date", "age",
            "education",
            "workshop_id", "workshop_name",
            "welding_since", "experience_years",
            "rank",
            "rfid_uid",
            "is_active",
        ]

    def validate_rfid_uid(self, value):
        """UID карты храним в нижнем регистре без пробелов.

        Один и тот же номер, набранный как 0080A182 и 0080a182, —
        это одна карта, но база сочтёт их разными и unique не сработает.
        """
        if not value:
            # пустую строку превращаем в None: unique=True считает
            # повтором две пустые строки, но не два NULL
            return None
        return value.strip().lower()


class WelderListSerializer(serializers.ModelSerializer):
    """Реестр сварщиков.

    is_attested и attestations_count берутся из аннотаций вьюсета,
    а не из свойства модели: свойство делает отдельный запрос
    на каждую строку, и список из тридцати человек дал бы
    тридцать лишних походов в базу.
    """

    workshop_name = serializers.CharField(
        source="workshop.name", read_only=True, default="",
    )
    experience_years = serializers.ReadOnlyField()

    is_attested = serializers.BooleanField(read_only=True)
    attestations_count = serializers.IntegerField(read_only=True)
    # худшее состояние срока по всем допускам: expired / soon / valid
    expiry_state = serializers.SerializerMethodField()

    class Meta:
        model = Welder
        fields = [
            "id", "fio", "personnel_no",
            "workshop_name", "rank",
            "experience_years",
            "is_attested", "attestations_count", "expiry_state",
            "is_active",
        ]

    def get_expiry_state(self, obj) -> str:
        """Сварщик аттестован на несколько способов, у каждого свой
        срок. В списке показываем худший: если хоть один просрочен,
        человека надо проверить."""
        states = [a.expiry_state for a in obj.attestations.all() if a.status == "done"]
        if not states:
            return ""
        for worst in ("expired", "soon", "valid"):
            if worst in states:
                return worst
        return ""