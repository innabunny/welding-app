from rest_framework import permissions, viewsets

from apps.accounts.permissions import IsTechnologyEditor
from .models import GasFlux, FillerMaterial, Material, MaterialGroup, MaterialPair
from .serializers import (
    GasFluxSerializer,
    FillerMaterialSerializer,
    MaterialGroupSerializer,
    MaterialSerializer,
    MaterialPairSerializer
)


class GasFluxViewSet(viewsets.ModelViewSet):
    queryset = GasFlux.objects.all()
    serializer_class = GasFluxSerializer
    permission_classes = [permissions.IsAuthenticated, IsTechnologyEditor]


class FillerMaterialViewSet(viewsets.ModelViewSet):
    queryset = FillerMaterial.objects.all()
    serializer_class = FillerMaterialSerializer
    permission_classes = [permissions.IsAuthenticated, IsTechnologyEditor]


class MaterialGroupViewSet(viewsets.ModelViewSet):
    queryset = MaterialGroup.objects.all()
    serializer_class = MaterialGroupSerializer
    permission_classes = [permissions.IsAuthenticated, IsTechnologyEditor]

class MaterialPairViewSet(viewsets.ModelViewSet):
    queryset = MaterialPair.objects.all()
    serializer_class = MaterialPairSerializer
    permission_classes = [permissions.IsAuthenticated, IsTechnologyEditor]    


class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.select_related("group")
    serializer_class = MaterialSerializer
    permission_classes = [permissions.IsAuthenticated, IsTechnologyEditor]