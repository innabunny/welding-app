from rest_framework import serializers
from .models import User
from apps.workshops.models import Workshop


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'login', 'password', 'name', 'role', 'active', 'workshop_id']

        extra_kwargs = {
            'password': {'write_only': True},
        }

    login = serializers.CharField(source='username')
    active = serializers.BooleanField(source='is_active')
    workshop_id = serializers.PrimaryKeyRelatedField(
        source='workshop',
        queryset=Workshop.objects.all() ,    
        allow_null=True, required=False,
    )

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)   
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)  
        instance.save()
        return instance
    
    def validate(self, attrs):
        # роль и цех после применения изменений (важно для update)
        role = attrs.get('role', getattr(self.instance, 'role', None))
        workshop = attrs.get('workshop', getattr(self.instance, 'workshop', None))

        if role != 'admin' and workshop is None:
            raise serializers.ValidationError({
                'workshopId': 'Цех обязателен для всех ролей, кроме администратора.'
            })
        return attrs
 