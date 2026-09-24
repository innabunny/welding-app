from rest_framework import serializers
from .models import GasFlux, FillerMaterial, MaterialGroup, Material, MaterialPair


class GasFluxSerializer(serializers.ModelSerializer):
    class Meta:
        model = GasFlux
        fields = ["id", "kind", "value"]


class FillerMaterialSerializer(serializers.ModelSerializer):
    label = serializers.CharField(source="__str__", read_only=True)

    class Meta:
        model = FillerMaterial
        fields = ["id", "marka", "kind", "diameter", "label"]


class MaterialSerializer(serializers.ModelSerializer):
    group_id = serializers.PrimaryKeyRelatedField(
        source="group",
        queryset=MaterialGroup.objects.all(),
        required=False,
        allow_null=True,
    )
    group_code = serializers.CharField(
        source="group.code", read_only=True, default=None
    )

    class Meta:
        model = Material
        fields = ["id", "marka", "group_id", "group_code", "tensile_strength"]


class MaterialGroupSerializer(serializers.ModelSerializer):

    class Meta:
        model = MaterialGroup
        fields = ["id", "code"]

class MaterialPairSerializer(serializers.ModelSerializer):
    fillers = FillerMaterialSerializer(many=True, read_only=True)
    fluxes = GasFluxSerializer(many=True, read_only=True)

    class Meta:
        model = MaterialPair
        fields = ['id', 'material_1', 'material_2', 'fillers', 'fluxes']        