from rest_framework import serializers
from .models import  WeldingMethod

class WeldingMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeldingMethod
        fields = [
            "id",
            "name",
            "designation",
            "process",
            "tpl_key",
            "order",
            "is_active",
        ]