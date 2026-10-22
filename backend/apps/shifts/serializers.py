from rest_framework import serializers

from .models import CalendarException, ShiftDay, ShiftSchedule


class ShiftDaySerializer(serializers.ModelSerializer):
    weekday_name = serializers.CharField(source="get_weekday_display", read_only=True)
    work_hours = serializers.SerializerMethodField()

    class Meta:
        model = ShiftDay
        fields = [
            "id", "weekday", "weekday_name", "is_working",
            "starts_at", "ends_at", "break_start", "break_end", "work_hours",
        ]

    def get_work_hours(self, obj) -> float:
        return round(obj.work_seconds / 3600, 2)


class ShiftScheduleSerializer(serializers.ModelSerializer):
    # вложенный список: график приходит сразу со своими днями,
    # фронту не нужен второй запрос
    days = ShiftDaySerializer(many=True, read_only=True)
    workshop_name = serializers.CharField(source="workshop.name", read_only=True, default="")

    class Meta:
        model = ShiftSchedule
        fields = [
            "id", "name", "workshop", "workshop_name", "number",
            "valid_from", "valid_to", "days",
        ]


class CalendarExceptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarException
        fields = [
            "id", "day", "kind", "comment", "schedule",
            "starts_at", "ends_at", "break_start", "break_end",
        ]