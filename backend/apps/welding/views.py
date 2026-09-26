from django.db.models import Count, Prefetch, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    ArcRun,
    Inspection,
    OperationRun,
    PartInstance,
    Weld,
    WeldingSession,
    WeldPassRun,
    RouteCode,
)
from .serializers import (
    ArcRunSerializer,
    InspectionSerializer,
    OperationRunSerializer,
    PartInstanceSerializer,
    WeldingSessionSerializer,
    WeldPassportSerializer,
    WeldSerializer,
    RouteCodeSerializer,
)


class PartInstanceViewSet(viewsets.ModelViewSet):
    """Изделия с заводскими номерами."""

    queryset = PartInstance.objects.select_related("part").prefetch_related("welds")
    serializer_class = PartInstanceSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        part = params.get("part")
        if part:
            qs = qs.filter(part_id=part)

        kind = params.get("kind")
        if kind:
            qs = qs.filter(kind=kind)

        search = params.get("search")
        if search:
            qs = qs.filter(
                Q(serial_no__icontains=search)
                | Q(part__number__icontains=search)
                | Q(part__name__icontains=search)
            )

        return qs


class WeldViewSet(viewsets.ModelViewSet):
    """Сваренные швы. Паспорт шва — действие passport."""

    queryset = Weld.objects.select_related(
        "instance", "instance__part", "seam", "seam__material_1", "seam__material_2"
    )
    serializer_class = WeldSerializer

    def get_serializer_class(self):
        if self.action in ("retrieve", "passport"):
            return WeldPassportSerializer
        return WeldSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        # для паспорта тянем всю цепочку сразу: операции, проходы,
        # сегменты дуги и заключения. Иначе на один паспорт уйдут
        # десятки запросов
        if self.action in ("retrieve", "passport"):
            qs = qs.prefetch_related(
                Prefetch(
                    "runs",
                    queryset=OperationRun.objects.select_related(
                        "operation", "card", "card__method", "welder", "equipment"
                    ).prefetch_related(
                        "passes", "passes__planned_pass", "passes__arcs", "inspections"
                    ),
                )
            )

        params = self.request.query_params

        instance = params.get("instance")
        if instance:
            qs = qs.filter(instance_id=instance)

        part = params.get("part")
        if part:
            qs = qs.filter(instance__part_id=part)

        status = params.get("status")
        if status:
            qs = qs.filter(status=status)

        search = params.get("search")
        if search:
            qs = qs.filter(
                Q(instance__serial_no__icontains=search)
                | Q(instance__part__number__icontains=search)
                | Q(seam__number__icontains=search)
            )

        return qs

    @action(detail=True, methods=["get"])
    def passport(self, request, pk=None):
        """Паспорт шва: план, факт и контроль одним ответом.

        Паспорт не хранится, а собирается из связей — при правке
        карты ничего пересобирать не надо.
        """
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=False, methods=["get"])
    def awaiting_control(self, request):
        """Швы, где операция выполнена, а назначенного контроля нет.

        Это плашка «швы ждут контроля» на рабочем столе.
        Считается в Python, а не запросом: required_controls — JSON,
        и сравнивать его со списком заключений в SQL неудобно.
        """
        runs = (
            OperationRun.objects.filter(status="done")
            .select_related(
                "operation", "weld", "weld__instance", "weld__instance__part",
                "weld__seam",
            )
            .prefetch_related("inspections")
        )

        waiting = []
        for run in runs:
            required = run.operation.required_controls or []
            if not required:
                continue
            done = {i.method for i in run.inspections.all()}
            missing = [m for m in required if m not in done]
            if missing:
                waiting.append(
                    {
                        "run_id": run.id,
                        "weld_id": run.weld_id,
                        "part_number": run.weld.instance.part.number,
                        "serial_no": run.weld.instance.serial_no,
                        "seam_number": run.weld.seam.number,
                        "operation_number": run.operation.number,
                        "finished_at": run.finished_at,
                        "missing": missing,
                    }
                )

        return Response({"count": len(waiting), "items": waiting[:50]})


class OperationRunViewSet(viewsets.ModelViewSet):
    """Выполнение операций."""

    queryset = OperationRun.objects.select_related(
        "weld", "operation", "card", "card__method", "welder", "equipment"
    ).prefetch_related("passes", "passes__arcs", "inspections")
    serializer_class = OperationRunSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        weld = params.get("weld")
        if weld:
            qs = qs.filter(weld_id=weld)

        card = params.get("card")
        if card:
            qs = qs.filter(card_id=card)

        welder = params.get("welder")
        if welder:
            qs = qs.filter(welder_id=welder)

        equipment = params.get("equipment")
        if equipment:
            qs = qs.filter(equipment_id=equipment)

        status = params.get("status")
        if status:
            qs = qs.filter(status=status)

        # только с внесёнными замерами усадки
        if params.get("has_shrinkage") == "1":
            qs = qs.filter(size_before__isnull=False, size_after__isnull=False)

        return qs


class InspectionViewSet(viewsets.ModelViewSet):
    """Заключения контроля."""

    queryset = Inspection.objects.select_related(
        "run", "run__weld", "run__weld__instance", "run__operation"
    )
    serializer_class = InspectionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        run = params.get("run")
        if run:
            qs = qs.filter(run_id=run)

        weld = params.get("weld")
        if weld:
            qs = qs.filter(run__weld_id=weld)

        method = params.get("method")
        if method:
            qs = qs.filter(method=method)

        result = params.get("result")
        if result:
            qs = qs.filter(result=result)

        # вырезки в статистику качества не идут: их делают только
        # из брака, и выборка окажется смещённой
        if params.get("for_stats") == "1":
            qs = qs.filter(specimen__in=["шов", "свидетель"])

        return qs

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Сводка по результатам — для графика доли брака."""
        qs = self.get_queryset().filter(specimen__in=["шов", "свидетель"])
        counts = qs.aggregate(
            total=Count("id"),
            passed=Count("id", filter=Q(result="годен")),
            rework=Count("id", filter=Q(result="исправление")),
            failed=Count("id", filter=Q(result="брак")),
        )
        total = counts["total"] or 0
        counts["defect_rate"] = (
            round((counts["rework"] + counts["failed"]) / total * 100, 1)
            if total else 0
        )
        return Response(counts)


class WeldingSessionViewSet(viewsets.ModelViewSet):
    """Сеансы сварки — корень телеметрии."""

    queryset = WeldingSession.objects.select_related(
        "equipment", "welder", "operation_run"
    ).prefetch_related("arcs")
    serializer_class = WeldingSessionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        equipment = params.get("equipment")
        if equipment:
            qs = qs.filter(equipment_id=equipment)

        welder = params.get("welder")
        if welder:
            qs = qs.filter(welder_id=welder)

        mode = params.get("mode")
        if mode:
            qs = qs.filter(mode=mode)

        # незакрытые сеансы — то, что идёт прямо сейчас
        if params.get("active") == "1":
            qs = qs.filter(finished_at__isnull=True)

        # сварка без привязки к технологии: отработка и прихватка.
        # Много таких — вопрос к мастеру, и это организационная мера,
        # а не техническое ограничение
        if params.get("unlinked") == "1":
            qs = qs.filter(operation_run__isnull=True)

        return qs

    @action(detail=True, methods=["get"])
    def arcs(self, request, pk=None):
        """Участки дуги внутри сеанса."""
        session = self.get_object()
        qs = session.arcs.all().order_by("started_at")
        return Response(ArcRunSerializer(qs, many=True).data)

class RouteCodeViewSet(viewsets.ModelViewSet):
    """Коды маршрутных листов.

    Действие resolve — вход для узла: пришли цифры с QR, надо понять,
    что варим. Если кода нет, узел всё равно пишет параметры,
    а портал покажет «техкарта отсутствует».
    """

    queryset = RouteCode.objects.select_related(
        "part", "operation", "operation__seam", "operation__card", "instance"
    )
    serializer_class = RouteCodeSerializer

    @action(detail=False, methods=["get"])
    def resolve(self, request):
        code = (request.query_params.get("code") or "").strip()
        if not code:
            return Response({"detail": "Нужен параметр code"}, status=400)

        rc = self.get_queryset().filter(code=code).first()
        if rc is None:
            return Response(
                {"found": False, "detail": "Код не зарегистрирован"}, status=404
            )
        return Response({"found": True, **RouteCodeSerializer(rc).data})        