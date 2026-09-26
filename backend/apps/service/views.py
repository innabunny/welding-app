from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import ServiceRequest
from .serializers import ServiceRequestSerializer


class ServiceRequestViewSet(viewsets.ModelViewSet):
    """Заявки на обслуживание оборудования."""

    queryset = ServiceRequest.objects.select_related(
        "equipment", "equipment__method"
    )
    serializer_class = ServiceRequestSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        status = params.get("status")
        if status:
            qs = qs.filter(status=status)

        # открытые — то, что ждёт механика
        if params.get("open") == "1":
            qs = qs.filter(status__in=["open", "in_work"])

        equipment = params.get("equipment")
        if equipment:
            qs = qs.filter(equipment_id=equipment)

        priority = params.get("priority")
        if priority:
            qs = qs.filter(priority=priority)

        # мои заявки — для мастера, который подавал
        if params.get("mine") == "1" and self.request.user.is_authenticated:
            qs = qs.filter(author=self.request.user)

        search = params.get("search")
        if search:
            qs = qs.filter(
                Q(equipment__name__icontains=search)
                | Q(description__icontains=search)
            )

        return qs

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Сводка для плашки на рабочем столе."""
        qs = ServiceRequest.objects.all()
        counts = qs.aggregate(
            open=Count("id", filter=Q(status="open")),
            in_work=Count("id", filter=Q(status="in_work")),
            high=Count("id", filter=Q(status__in=["open", "in_work"], priority="высокая")),
        )
        return Response(counts)