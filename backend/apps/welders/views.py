from datetime import date

from django.db.models import Case, Count, Exists, OuterRef, Q, When
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.attestation.models import Attestation

from .models import Welder
from .serializers import WelderListSerializer, WelderSerializer


class WelderViewSet(viewsets.ModelViewSet):
    """Сварщики."""

    queryset = Welder.objects.select_related("workshop")
    serializer_class = WelderSerializer

    def get_serializer_class(self):
        if self.action == "list":
            return WelderListSerializer
        return WelderSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        if self.action == "list":
            # Exists — подзапрос «есть ли хоть одна действующая аттестация».
            # База проверяет это одним запросом на весь список,
            # а не отдельным на каждого человека
            has_valid = Attestation.objects.filter(
                welder=OuterRef("pk"),
                status="done",
                valid_until__gte=date.today(),
            )
            qs = qs.annotate(
                is_attested=Exists(has_valid),
                attestations_count=Count("attestations", distinct=True),
            ).prefetch_related("attestations")

        params = self.request.query_params

        search = params.get("search")
        if search:
            qs = qs.filter(
                Q(fio__icontains=search) | Q(personnel_no__icontains=search)
            )

        workshop = params.get("workshop")
        if workshop:
            qs = qs.filter(workshop_id=workshop)

        if params.get("active") == "1":
            qs = qs.filter(is_active=True)

        # только те, кто аттестован хотя бы на один способ
        attested = params.get("attested")
        if attested == "1":
            qs = qs.filter(
                attestations__status="done",
                attestations__valid_until__gte=date.today(),
            ).distinct()
        elif attested == "0":
            qs = qs.exclude(
                attestations__status="done",
                attestations__valid_until__gte=date.today(),
            )

        # у кого не привязана RFID-карта — список для выдачи карт
        if params.get("no_card") == "1":
            qs = qs.filter(Q(rfid_uid__isnull=True) | Q(rfid_uid=""))

        return qs

    @action(detail=False, methods=["get"], url_path="by-card")
    def by_card(self, request):
        """Найти сварщика по UID карты.

        Это вход для узла телеметрии: приложили карту — узел спрашивает,
        кто это и есть ли у него действующий допуск.

        /api/welders/by-card/?uid=0080a182
        """
        uid = (request.query_params.get("uid") or "").strip().lower()
        if not uid:
            return Response({"detail": "Нужен параметр uid"}, status=400)

        welder = (
            Welder.objects.select_related("workshop")
            .filter(rfid_uid=uid, is_active=True)
            .first()
        )
        if welder is None:
            return Response({"found": False, "detail": "Карта не зарегистрирована"}, status=404)

        # действующие допуски: на какие способы человек аттестован сейчас
        valid = welder.attestations.filter(
            status="done", valid_until__gte=date.today()
        ).select_related("method")

        return Response(
            {
                "found": True,
                "id": welder.id,
                "fio": welder.fio,
                "workshop": welder.workshop.name if welder.workshop else "",
                "methods": [
                    {
                        "id": a.method_id,
                        "name": a.method.name,
                        "valid_until": a.valid_until,
                    }
                    for a in valid
                ],
                "has_valid_attestation": valid.exists(),
            }
        )