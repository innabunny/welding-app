from django.utils import timezone
from rest_framework import serializers

from apps.equipment.models import Equipment

from .models import ServiceRequest


class ServiceRequestSerializer(serializers.ModelSerializer):
    """Заявка на обслуживание."""

    equipment_id = serializers.PrimaryKeyRelatedField(
        source="equipment", queryset=Equipment.objects.all(),
    )
    equipment_name = serializers.CharField(source="equipment.name", read_only=True)
    method_name = serializers.CharField(
        source="equipment.method.name", read_only=True, default="",
    )

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    reason_display = serializers.CharField(source="get_reason_display", read_only=True)
    priority_display = serializers.CharField(
        source="get_priority_display", read_only=True,
    )
    is_open = serializers.ReadOnlyField()

    class Meta:
        model = ServiceRequest
        fields = [
            "id",
            "equipment_id", "equipment_name", "method_name",
            "reason", "reason_display",
            "priority", "priority_display",
            "description",
            "status", "status_display", "is_open",
            "author_name", "created_at",
            "closed_by_name", "closed_at", "resolution",
        ]
        # заявителя и даты проставляет сервер, фронт их не шлёт
        read_only_fields = [
            "author_name", "created_at",
            "closed_by_name", "closed_at",
        ]

    def validate(self, attrs):
        """Закрытую заявку править нельзя — это история."""
        if self.instance and self.instance.status in ("done", "rejected"):
            raise serializers.ValidationError(
                "Заявка закрыта, править её нельзя"
            )
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["author"] = request.user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context.get("request")
        new_status = validated_data.get("status")

        # при переводе в done/rejected проставляем, кто и когда закрыл
        if new_status in ("done", "rejected") and instance.status != new_status:
            validated_data["closed_at"] = timezone.now()
            if request and request.user.is_authenticated:
                validated_data["closed_by"] = request.user
                validated_data["closed_by_name"] = request.user.name

        return super().update(instance, validated_data)