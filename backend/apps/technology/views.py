from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Operation, Part, SeamSpec
from .serializers import (
    OperationSerializer,
    PartDetailSerializer,
    PartSerializer,
    SeamSpecSerializer,
)


class PartViewSet(viewsets.ModelViewSet):
    """Детали по чертежу."""

    # prefetch_related подтягивает швы и операции одним запросом на всех,
    # а не отдельным на каждую деталь
    queryset = Part.objects.prefetch_related("seams", "operations")
    serializer_class = PartSerializer

    def get_serializer_class(self):
        # в списке — короткий вид, в карточке — со вложенными швами
        if self.action == "retrieve":
            return PartDetailSerializer
        return PartSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        search = params.get("search")
        if search:
            qs = qs.filter(
                Q(number__icontains=search)
                | Q(name__icontains=search)
                | Q(drawing_no__icontains=search)
            )

        if params.get("active") == "1":
            qs = qs.filter(is_active=True)

        # детали, где есть операции без техкарты — где работа не доделана
        if params.get("without_cards") == "1":
            qs = qs.annotate(
                no_card=Count("operations", filter=Q(operations__card__isnull=True))
            ).filter(no_card__gt=0)

        return qs

    @action(detail=True, methods=["get"])
    def route(self, request, pk=None):
        """Маршрут детали: операции по порядку, с швом и картой.

        Это то, что видит технолог, открывая деталь: какие операции
        заведены, какой шов варится в каждой, есть ли техкарта.
        """
        part = self.get_object()
        operations = (
            part.operations.select_related("seam")
            .prefetch_related("card")
            .order_by("order", "number")
        )
        return Response(
            {
                "part": PartSerializer(part).data,
                "operations": OperationSerializer(operations, many=True).data,
            }
        )


class SeamSpecViewSet(viewsets.ModelViewSet):
    """Швы по чертежу."""

    queryset = SeamSpec.objects.select_related(
        "part", "material_1", "material_2"
    ).prefetch_related("operations")
    serializer_class = SeamSpecSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        part = params.get("part")
        if part:
            qs = qs.filter(part_id=part)

        material = params.get("material")
        if material:
            qs = qs.filter(Q(material_1_id=material) | Q(material_2_id=material))

        # поиск по толщине — пригодится для подбора режима:
        # «что уже варили на этой толщине»
        th_from = params.get("thickness_from")
        th_to = params.get("thickness_to")
        if th_from:
            qs = qs.filter(thickness__gte=th_from)
        if th_to:
            qs = qs.filter(thickness__lte=th_to)

        return qs.distinct()


class OperationViewSet(viewsets.ModelViewSet):
    """Операции техпроцесса."""

    queryset = Operation.objects.select_related("part", "seam")
    serializer_class = OperationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        part = params.get("part")
        if part:
            qs = qs.filter(part_id=part)

        seam = params.get("seam")
        if seam:
            qs = qs.filter(seam_id=seam)

        return qs

    @action(detail=False, methods=["get"])
    def lookup(self, request):
        """Найти операцию по номеру детали и номеру операции.

        Так портал разбирает то, что пришло с маршрутного листа:
        номера приходят строками, сквозной нумерации нет — номер
        операции уникален только внутри своей детали.

        /api/operations/lookup/?part=14.301&number=20
        """
        part_number = request.query_params.get("part")
        number = request.query_params.get("number")

        if not part_number or not number:
            return Response(
                {"detail": "Нужны оба параметра: part и number"}, status=400
            )

        operation = (
            Operation.objects.select_related("part", "seam")
            .filter(part__number=part_number, number=number)
            .first()
        )
        if operation is None:
            return Response(
                {"detail": "Операция не найдена", "found": False}, status=404
            )

        return Response({"found": True, **OperationSerializer(operation).data})