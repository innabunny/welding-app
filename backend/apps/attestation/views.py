from datetime import date, timedelta

from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Attestation, AttestationRule
from .serializers import (
    AttestationListSerializer,
    AttestationRuleSerializer,
    AttestationSerializer,
)

# порог «скоро истекает» — тот же, что в expiry_state модели
SOON_DAYS = 60


class AttestationRuleViewSet(viewsets.ReadOnlyModelViewSet):
    """Библиотека правил. Только чтение: наполняется через админку."""

    queryset = AttestationRule.objects.select_related("method", "group")
    serializer_class = AttestationRuleSerializer

    def get_queryset(self):
        qs = super().get_queryset().filter(is_active=True)
        params = self.request.query_params

        method = params.get("method")
        if method:
            qs = qs.filter(method_id=method)

        group = params.get("group")
        if group:
            qs = qs.filter(group_id=group)

        # правило, покрывающее заданную толщину:
        # th_from <= толщина, и либо th_to пусто («и выше»), либо >= толщины
        thickness = params.get("thickness")
        if thickness:
            qs = qs.filter(th_from__lte=thickness).filter(
                Q(th_to__isnull=True) | Q(th_to__gte=thickness)
            )

        return qs


class AttestationViewSet(viewsets.ModelViewSet):
    """Аттестации сварщиков."""

    queryset = Attestation.objects.select_related(
        "welder", "welder__workshop", "method", "group"
    ).prefetch_related("items", "items__material1", "items__material2")
    serializer_class = AttestationSerializer

    def get_serializer_class(self):
        if self.action == "list":
            return AttestationListSerializer
        return AttestationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        search = params.get("search")
        if search:
            qs = qs.filter(
                Q(welder__fio__icontains=search)
                | Q(protocol_no__icontains=search)
                | Q(certificate_no__icontains=search)
            )

        welder = params.get("welder")
        if welder:
            qs = qs.filter(welder_id=welder)

        method = params.get("method")
        if method:
            qs = qs.filter(method_id=method)

        status = params.get("status")
        if status:
            qs = qs.filter(status=status)

        workshop = params.get("workshop")
        if workshop:
            qs = qs.filter(welder__workshop_id=workshop)

        # фильтр по сроку — тот же смысл, что у цветных плашек в реестре
        expiry = params.get("expiry")
        if expiry:
            today = date.today()
            if expiry == "expired":
                qs = qs.filter(valid_until__lt=today)
            elif expiry == "soon":
                qs = qs.filter(
                    valid_until__gte=today,
                    valid_until__lte=today + timedelta(days=SOON_DAYS),
                )
            elif expiry == "valid":
                qs = qs.filter(valid_until__gt=today + timedelta(days=SOON_DAYS))

        return qs

    def destroy(self, request, *args, **kwargs):
        """Удалять можно только черновик: у остальных документы уже ушли."""
        attestation = self.get_object()
        if attestation.status != "draft":
            return Response(
                {"detail": "Удалить можно только черновик"}, status=400
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def expiring(self, request):
        """Допуски, истекающие в ближайшие 60 дней, и уже просроченные.

        Это данные для плашки на рабочем столе. Отсортировано так,
        что просроченные идут первыми.
        """
        today = date.today()
        qs = (
            self.get_queryset()
            .filter(
                status="done",
                valid_until__isnull=False,
                valid_until__lte=today + timedelta(days=SOON_DAYS),
            )
            .order_by("valid_until")
        )

        expired = qs.filter(valid_until__lt=today)
        soon = qs.filter(valid_until__gte=today)

        return Response(
            {
                "expired_count": expired.count(),
                "soon_count": soon.count(),
                "items": AttestationListSerializer(qs[:20], many=True).data,
            }
        )