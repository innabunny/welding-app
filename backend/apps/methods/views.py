
from rest_framework import viewsets
from .models import WeldingMethod
from .serializers import WeldingMethodSerializer

class WeldingMethodViewSet(viewsets.ReadOnlyModelViewSet):   # только чтение
    queryset = WeldingMethod.objects.all()
    serializer_class = WeldingMethodSerializer