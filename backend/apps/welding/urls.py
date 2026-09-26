
from rest_framework.routers import DefaultRouter

from .views import (
    InspectionViewSet,
    OperationRunViewSet,
    PartInstanceViewSet,
    WeldingSessionViewSet,
    WeldViewSet,
    RouteCodeViewSet,
)

router = DefaultRouter()
router.register("instances", PartInstanceViewSet, basename="part-instance")
router.register("welds", WeldViewSet, basename="weld")
router.register("operation-runs", OperationRunViewSet, basename="operation-run")
router.register("inspections", InspectionViewSet, basename="inspection")
router.register("welding-sessions", WeldingSessionViewSet, basename="welding-session")
router.register("route-codes", RouteCodeViewSet, basename="route-code")

urlpatterns = router.urls