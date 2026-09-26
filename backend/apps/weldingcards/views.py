from decimal import Decimal, InvalidOperation

from django.db.models import Avg, Count, Max, Min, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import WeldingCard, WeldPass
from .serializers import WeldingCardListSerializer, WeldingCardSerializer

# ниже этого числа карт выборка считается непредставительной
# и расширяется со способа на весь процесс
MIN_CARDS = 3


def _dec(value):
    """Строка из query-параметра в Decimal. None, если не число."""
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


class WeldingCardViewSet(viewsets.ModelViewSet):
    """Технологические карты."""

    # вся цепочка операция → деталь / шов → материалы тянется сразу:
    # иначе на каждую строку списка пойдёт по пять запросов
    queryset = WeldingCard.objects.select_related(
        "operation",
        "operation__part",
        "operation__seam",
        "operation__seam__material_1",
        "operation__seam__material_2",
        "method",
        "equipment",
    ).prefetch_related("passes", "passes__speed_unit")
    serializer_class = WeldingCardSerializer

    def get_serializer_class(self):
        if self.action == "list":
            return WeldingCardListSerializer
        return WeldingCardSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        search = params.get("search")
        if search:
            qs = qs.filter(
                Q(card_no__icontains=search)
                | Q(operation__part__number__icontains=search)
                | Q(operation__part__name__icontains=search)
                | Q(operation__seam__material_1__marka__icontains=search)
                | Q(operation__seam__material_2__marka__icontains=search)
            )

        part = params.get("part")
        if part:
            qs = qs.filter(operation__part_id=part)

        method = params.get("method")
        if method:
            qs = qs.filter(method_id=method)

        process = params.get("process")
        if process:
            qs = qs.filter(method__process=process)

        equipment = params.get("equipment")
        if equipment:
            qs = qs.filter(equipment_id=equipment)

        material = params.get("material")
        if material:
            qs = qs.filter(
                Q(operation__seam__material_1_id=material)
                | Q(operation__seam__material_2_id=material)
            )

        # толщина теперь одна — у шва, а не две у карты
        th_from = _dec(params.get("thickness_from"))
        th_to = _dec(params.get("thickness_to"))
        if th_from is not None:
            qs = qs.filter(
                Q(operation__seam__thickness_1__gte=th_from)
                | Q(operation__seam__thickness_2__gte=th_from)
            )
        if th_to is not None:
            qs = qs.filter(
                Q(operation__seam__thickness_1__lte=th_to)
                | Q(operation__seam__thickness_2__lte=th_to)
            )
        released = params.get("released")
        if released == "1":
            qs = qs.filter(is_released=True)
        elif released == "0":
            qs = qs.filter(is_released=False)

        return qs.distinct()

    @action(detail=False, methods=["get"])
    def similar(self, request):
        """Подсказка режимов: что уже применяли на похожем соединении.

        Статистика считается ПО НОМЕРАМ ПРОХОДОВ отдельно. Смешивать
        их в одну кучу нельзя: у корня ток 90-110, у заполнения 140-160,
        и общий диапазон 90-160 бесполезен.

        Параметры: method, material, thickness, tolerance (по умолчанию 2 мм).
        """
        method = request.query_params.get("method")
        material = request.query_params.get("material")
        thickness = _dec(request.query_params.get("thickness"))
        tolerance = _dec(request.query_params.get("tolerance")) or Decimal("2")

        base = WeldingCard.objects.select_related(
            "operation__part", "operation__seam", "method"
        )

        def build(by_process=False):
            qs = base
            if method:
                if by_process:
                    processes = WeldingCard.objects.filter(
                        method_id=method
                    ).values_list("method__process", flat=True)[:1]
                    qs = qs.filter(method__process__in=processes)
                else:
                    qs = qs.filter(method_id=method)
            if material:
                qs = qs.filter(
                    Q(operation__seam__material_1_id=material)
                    | Q(operation__seam__material_2_id=material)
                )
            if thickness is not None:
                lo = thickness - tolerance
                hi = thickness + tolerance
                qs = qs.filter(
                    Q(operation__seam__thickness_1__gte=lo,
                      operation__seam__thickness_1__lte=hi)
                    | Q(operation__seam__thickness_2__gte=lo,
                        operation__seam__thickness_2__lte=hi)
                )
            return qs.distinct()

        qs = build()
        level = "способ"
        if qs.count() < MIN_CARDS and method:
            wider = build(by_process=True)
            if wider.count() > qs.count():
                qs, level = wider, "процесс"

        total = qs.count()
        if total == 0:
            return Response({"count": 0, "level": None, "cards": [], "passes": []})

        # values("no") задаёт группировку по номеру прохода,
        # annotate считает внутри каждой группы
        by_pass = (
            WeldPass.objects.filter(card__in=qs)
            .values("no")
            .annotate(
                current_from=Min("current_min"),
                current_to=Max("current_max"),
                current_avg=Avg("current_min"),
                voltage_from=Min("voltage_min"),
                voltage_to=Max("voltage_max"),
                speed_from=Min("speed_min"),
                speed_to=Max("speed_max"),
                wire_speed_from=Min("wire_speed_min"),
                wire_speed_to=Max("wire_speed_max"),
                gas_flow_from=Min("gas_flow_min"),
                gas_flow_to=Max("gas_flow_max"),
                cards=Count("card", distinct=True),
            )
            .order_by("no")
        )

        return Response(
            {
                "count": total,
                "level": level,
                "cards": WeldingCardListSerializer(qs[:20], many=True).data,
                "passes": list(by_pass),
            }
        )