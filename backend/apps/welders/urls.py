from rest_framework.routers import DefaultRouter
from .views import WelderViewSet

router = DefaultRouter()
router.register('welders', WelderViewSet, basename='welder')
urlpatterns = router.urls