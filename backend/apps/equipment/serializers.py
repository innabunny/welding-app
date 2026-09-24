from rest_framework import serializers
from .models import Equipment, WeldingMethod
from accounts.models import Workshop


class EquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipment
        fields = ['id', 'name', 'method', 'workshop_id']

    method = serializers.PrimaryKeyRelatedField(queryset=WeldingMethod.objects.all())
    workshop_id = serializers.PrimaryKeyRelatedField(
        source='workshop',
        queryset=Workshop.objects.all(),
        allow_null=True, required=False,
    )

