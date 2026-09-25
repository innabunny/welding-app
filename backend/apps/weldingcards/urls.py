from rest_framework.routers import DefaultRouter

from .views import WeldingCardViewSet

router = DefaultRouter()
router.register("welding-cards", WeldingCardViewSet, basename="welding-card")

urlpatterns = router.urls