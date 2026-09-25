from rest_framework.routers import DefaultRouter

from .views import SectionViewSet, WorkshopViewSet, WorkstationViewSet

router = DefaultRouter()
router.register("workshops", WorkshopViewSet, basename="workshop")
router.register("sections", SectionViewSet, basename="section")
router.register("workstations", WorkstationViewSet, basename="workstation")

urlpatterns = router.urls