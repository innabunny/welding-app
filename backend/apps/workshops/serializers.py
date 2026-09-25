from rest_framework import serializers

from .models import Section, Workshop, Workstation


class WorkstationSerializer(serializers.ModelSerializer):
    """Рабочее место."""

    section_id = serializers.PrimaryKeyRelatedField(
        source="section", queryset=Section.objects.all(),
    )
    section_name = serializers.CharField(source="section.name", read_only=True)
    workshop_name = serializers.CharField(
        source="section.workshop.name", read_only=True,
    )
    equipment_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Workstation
        fields = [
            "id", "number", "name",
            "section_id", "section_name", "workshop_name",
            "equipment_count", "is_active",
        ]


class SectionSerializer(serializers.ModelSerializer):
    """Участок."""

    workshop_id = serializers.PrimaryKeyRelatedField(
        source="workshop", queryset=Workshop.objects.all(),
    )
    workshop_name = serializers.CharField(source="workshop.name", read_only=True)
    workstations_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Section
        fields = [
            "id", "name", "number",
            "workshop_id", "workshop_name",
            "workstations_count",
        ]


class WorkshopSerializer(serializers.ModelSerializer):
    """Цех.

    Счётчики идут из аннотаций вьюсета, а не считаются на лету:
    иначе на каждую строку списка пойдёт по нескольку запросов.
    """

    welders_count = serializers.IntegerField(read_only=True, default=0)
    users_count = serializers.IntegerField(read_only=True, default=0)
    sections_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Workshop
        fields = [
            "id", "name", "number",
            "welders_count", "users_count", "sections_count",
        ]

    def validate_number(self, value):
        """Номер цеха уникален. unique=True в модели не поставлен:
        номер необязателен, а две пустые строки база сочла бы повтором.
        """
        value = (value or "").strip()
        if not value:
            return value

        qs = Workshop.objects.filter(number=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Цех с таким номером уже есть")
        return value


class WorkshopDetailSerializer(WorkshopSerializer):
    """Карточка цеха: участки вложенным списком."""

    sections = SectionSerializer(many=True, read_only=True)

    class Meta(WorkshopSerializer.Meta):
        fields = WorkshopSerializer.Meta.fields + ["sections"]