# apps/equipment/urls.py

from rest_framework.routers import DefaultRouter

from .views import EquipmentParameterViewSet, EquipmentViewSet, SpeedUnitViewSet

router = DefaultRouter()
router.register("equipment", EquipmentViewSet, basename="equipment")
router.register("speed-units", SpeedUnitViewSet, basename="speed-unit")
router.register(
    "equipment-parameters", EquipmentParameterViewSet, basename="equipment-parameter"
)

urlpatterns = router.urls