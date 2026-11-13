from rest_framework import viewsets
from .models import Part, Operation, SeamSpec
from .serializers import PartSerializer, OperationSerializer, SeamSpecSerializer


class PartViewSet(viewsets.ModelViewSet):
    queryset = Part.objects.all()
    serializer_class = PartSerializer


class OperationViewSet(viewsets.ModelViewSet):
    queryset = Operation.objects.all()
    serializer_class = OperationSerializer


class SeamSpecViewSet(viewsets.ModelViewSet):
    queryset = SeamSpec.objects.all()
    serializer_class = SeamSpecSerializer