from rest_framework.routers import DefaultRouter
from .views import AttestationRuleViewSet, AttestationViewSet

router = DefaultRouter()
router.register('attestations', AttestationViewSet)
router.register('attestation-rules', AttestationRuleViewSet)

urlpatterns = router.urls