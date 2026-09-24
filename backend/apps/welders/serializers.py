from rest_framework import serializers
from accounts.models import Workshop
from .models import Welder


class WelderSerializer(serializers.ModelSerializer):
    workshop_id = serializers.PrimaryKeyRelatedField(
        source='workshop', queryset=Workshop.objects.all(),
        required=False, allow_null=True)
    workshop_name = serializers.CharField(source='workshop.name', read_only=True, default=None)
    workshop_number = serializers.CharField(source='workshop.number', read_only=True, default='')
    age = serializers.IntegerField(read_only=True)
    experience_years = serializers.IntegerField(read_only=True)
    is_attested = serializers.BooleanField(read_only=True)

    class Meta:
        model = Welder
        fields = ['id', 'fio', 'birth_date', 'education', 'workshop_id', 'workshop_name', 'workshop_number',
                  'welding_since', 'rank', 'is_active', 'age', 'experience_years', 'is_attested']