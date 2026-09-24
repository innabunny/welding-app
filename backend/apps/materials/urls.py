from rest_framework.routers import DefaultRouter
from .views import MaterialViewSet, MaterialGroupViewSet, GasFluxViewSet, FillerMaterialViewSet, MaterialPairViewSet

router = DefaultRouter()
router.register('gas-flux', GasFluxViewSet)
router.register('filler-materials', FillerMaterialViewSet)
router.register('material-groups', MaterialGroupViewSet, basename='material-group')
router.register('material-pairs', MaterialPairViewSet, basename='material-pair')
router.register('materials', MaterialViewSet, basename='material')
urlpatterns = router.urls