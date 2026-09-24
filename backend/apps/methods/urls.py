from rest_framework.routers import DefaultRouter
from .views import WeldingMethodViewSet

router = DefaultRouter()
router.register('welding-methods', WeldingMethodViewSet)
urlpatterns = router.urls
