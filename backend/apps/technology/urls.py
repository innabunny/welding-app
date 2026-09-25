

from rest_framework.routers import DefaultRouter

from .views import OperationViewSet, PartViewSet, SeamSpecViewSet

router = DefaultRouter()
router.register("parts", PartViewSet, basename="part")
router.register("seams", SeamSpecViewSet, basename="seam")
router.register("operations", OperationViewSet, basename="operation")

urlpatterns = router.urls