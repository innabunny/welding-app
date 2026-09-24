from rest_framework.routers import DefaultRouter
from .views import AttestationRuleViewSet, AttestationViewSet

router = DefaultRouter()
router.register('attestation-rules', AttestationRuleViewSet)
router.register('attestations', AttestationViewSet)

urlpatterns = router.urls