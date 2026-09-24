from rest_framework import permissions, viewsets
from .models import GasFlux, FillerMaterial, Material, MaterialGroup, MaterialPair
from .serializers import (
    GasFluxSerializer,
    FillerMaterialSerializer,
    MaterialGroupSerializer,
    MaterialSerializer,
    MaterialPairSerializer
)


class IsAdminForWrite(permissions.BasePermission):
    def has_permission(self, request, view):
        if view.action in ("list", "retrieve"):
            return True
        return getattr(request.user, "role", None) == "admin"


class GasFluxViewSet(viewsets.ModelViewSet):
    queryset = GasFlux.objects.all()
    serializer_class = GasFluxSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminForWrite]


class FillerMaterialViewSet(viewsets.ModelViewSet):
    queryset = FillerMaterial.objects.all()
    serializer_class = FillerMaterialSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminForWrite]


class MaterialGroupViewSet(viewsets.ModelViewSet):
    queryset = MaterialGroup.objects.all()
    serializer_class = MaterialGroupSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminForWrite]

class MaterialPairViewSet(viewsets.ModelViewSet):
    queryset = MaterialPair.objects.all()
    serializer_class = MaterialPairSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminForWrite]    


class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.select_related("group")
    serializer_class = MaterialSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminForWrite]