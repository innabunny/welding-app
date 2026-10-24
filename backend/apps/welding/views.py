from django.db.models import Count, Prefetch, Q
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsTechnologyEditor
from .samples import read_arc_samples, read_session_samples
from datetime import date, timedelta


from apps.equipment.models import Equipment

from .utilization import fleet_utilization

from .models import (
    ArcRun,
    Inspection,
    OperationRun,
    PartInstance,
    Weld,
    WeldingSession,
    WeldPassRun,
    RouteCode,
    NodeOutage,
    NodeState,
    Deviation,
    WeldDecision
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
    NodeOutageSerializer,
    NodeStateSerializer,
    DeviationSerializer,
    WeldDecisionSerializer
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

    # статус шва и заключения ведут администратор и технолог
    permission_classes = [permissions.IsAuthenticated, IsTechnologyEditor]
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

    # статус шва и заключения ведут администратор и технолог
    permission_classes = [permissions.IsAuthenticated, IsTechnologyEditor]
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

    @action(detail=True, methods=["get"])
    def samples(self, request, pk=None):
        """GET /api/welding-sessions/<id>/samples/?points=2000

        Точки графика на весь сеанс. Устроено так же, как у участка
        дуги: прореживает ClickHouse, здесь только параметры.
        """
        session = self.get_object()

        try:
            points = int(request.query_params.get("points", 2000))
        except ValueError:
            points = 2000
        points = max(50, min(points, 5000))

        # замеры в ClickHouse помечены номером сеанса с узла,
        # а не id строки в Postgres
        return Response(read_session_samples(session.external_id, points))

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


class ArcRunViewSet(viewsets.ReadOnlyModelViewSet):
    """Участки горения дуги.

    Только чтение: записи создаёт приёмник телеметрии по данным
    аппарата, вручную их не заводят и не правят.
    """

    queryset = ArcRun.objects.select_related(
        "session", "session__equipment", "session__welder", "pass_run"
    )
    serializer_class = ArcRunSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        session = params.get("session")
        if session:
            qs = qs.filter(session_id=session)

        # участки, которые приёмник не смог достроить:
        # связь оборвалась, и конец участка не пришёл
        if params.get("incomplete") == "1":
            qs = qs.filter(telemetry_complete=False)

        return qs.order_by("started_at")

    @action(detail=True, methods=["get"])
    def samples(self, request, pk=None):
        """GET /api/arcs/<id>/samples/?points=1200

        Точки для графика. Прореживание делает ClickHouse,
        Django только передаёт параметры и отдаёт результат.
        """
        # get_object применяет права доступа и выдаёт 404, если
        # участка нет. Без него можно было бы прочитать точки
        # любого участка, подставив чужой id в адрес
        arc = self.get_object()

        try:
            points = int(request.query_params.get("points", 2000))
        except ValueError:
            points = 2000
        # ограничиваем сверху: запросом ?points=1000000
        # иначе можно положить и ClickHouse, и браузер
        points = max(50, min(points, 5000))

        return Response(read_arc_samples(arc.id, points))

class NodeStateViewSet(viewsets.ReadOnlyModelViewSet):
    """Состояние узлов телеметрии.
 
    Только чтение: эти строки пишет приёмник, руками их не правят.
    """
 
    queryset = NodeState.objects.select_related(
        "equipment", "equipment__workstation",
        "equipment__workstation__section",
        "equipment__workstation__section__workshop",
        )
    serializer_class = NodeStateSerializer
 
    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
 
        if params.get("offline") == "1":
            qs = qs.filter(is_online=False)
 
        # узлы, которые есть в сети, но не внесены в справочник
        if params.get("unlinked") == "1":
            qs = qs.filter(equipment__isnull=True)
 
        return qs
 
    @action(detail=False, methods=["get"])
    def summary(self, request):
        """GET /api/nodes/summary/
 
        Счётчики для плашки на дашборде: сколько узлов на связи,
        сколько молчит, сколько догоняет данные.
        """
        qs = self.get_queryset()
        total = qs.count()
        offline = qs.filter(is_online=False).count()
        catching_up = qs.filter(is_online=True, queued__gt=0).count()
 
        return Response({
            "total": total,
            "online": total - offline,
            "offline": offline,
            "catchingUp": catching_up,
            # узлы в сети, но без привязки к оборудованию —
            # повод сходить в справочник и завести запись
            "unlinked": qs.filter(equipment__isnull=True).count(),
        })
 
    @action(detail=True, methods=["get"])
    def outages(self, request, pk=None):
        """GET /api/nodes/<id>/outages/?from=...&to=...
 
        История пропаданий связи. Для страницы диагностики узла.
        """
        node = self.get_object()
        qs = node.outages.all()
 
        params = request.query_params
        if params.get("from"):
            qs = qs.filter(started_at__gte=params["from"])
        if params.get("to"):
            qs = qs.filter(started_at__lte=params["to"])
 
        return Response(NodeOutageSerializer(qs[:200], many=True).data)

class UtilizationViewSet(viewsets.ViewSet):
    """Загрузка оборудования: Кз и раскладка фонда времени.
 
    ViewSet, а не ModelViewSet: за этим адресом нет модели,
    только расчёт. Записей в базе «загрузка» не существует.
    """
 
    @action(detail=False, methods=["get"], url_path="")
    def report(self, request):
        """GET /api/utilization/?from=2026-10-01&to=2026-10-22&workshop=3
 
        Параметры:
          from, to   — период, ГГГГ-ММ-ДД (обязательны)
          workshop   — цех
          equipment  — конкретный аппарат
          method     — способ сварки
          elapsed=1  — не считать время, которое ещё не прошло
        """
        params = request.query_params
 
        try:
            date_from = date.fromisoformat(params["from"])
            date_to = date.fromisoformat(params["to"])
        except (KeyError, ValueError):
            return Response(
                {"detail": "Нужны параметры from и to в виде ГГГГ-ММ-ДД"}, status=400
            )
 
        if date_to < date_from:
            return Response({"detail": "Конец периода раньше начала"}, status=400)
        if (date_to - date_from) > timedelta(days=400):
            return Response({"detail": "Период больше года"}, status=400)
 
        qs = Equipment.objects.filter(is_active=True).select_related(
            "workstation", "workstation__section", "workstation__section__workshop",
            "method",
        )
 
        workshop = params.get("workshop")
        if workshop:
            qs = qs.filter(workstation__section__workshop_id=workshop)
 
        equipment = params.get("equipment")
        if equipment:
            qs = qs.filter(id=equipment)
 
        method = params.get("method")
        if method:
            qs = qs.filter(method_id=method)
 
        # Расчёт идёт по дням в Python, поэтому ограничиваем набор:
        # сто аппаратов за год — это много тысяч отрезков
        if qs.count() > 200:
            return Response(
                {"detail": "Слишком много оборудования, уточните фильтр"}, status=400
            )
 
        until = timezone.localtime() if params.get("elapsed") == "1" else None
        result = fleet_utilization(qs, date_from, date_to, until=until)
 
        return Response({
            "from": date_from,
            "to": date_to,
            "fundSeconds": result["fund_seconds"],
            "arcSeconds": result["arc_seconds"],
            "standbySeconds": result["standby_seconds"],
            "noDataSeconds": result["no_data_seconds"],
            "idleSeconds": result["idle_seconds"],
            "outsideShiftSeconds": result["outside_shift_seconds"],
            "kz": result["kz"],
            "kzAvailable": result["kz_available"],
            "equipmentCount": result["equipment_count"],
            "items": [
                {
                    "equipmentId": r.equipment_id,
                    "equipmentName": r.equipment_name,
                    "fundSeconds": r.fund_seconds,
                    "arcSeconds": r.arc_seconds,
                    "standbySeconds": r.standby_seconds,
                    "noDataSeconds": r.no_data_seconds,
                    "idleSeconds": r.idle_seconds,
                    "outsideShiftSeconds": r.outside_shift_seconds,
                    "kz": r.kz,
                    "kzAvailable": r.kz_available,
                    "sessions": r.sessions,
                    "arcs": r.arcs,
                    # расхождение баланса: в норме ноль. Отдаём наружу,
                    # чтобы ошибку расчёта было видно, а не искать потом,
                    # почему проценты не сходятся
                    "balanceErrorSeconds": r.balance_error_seconds,
                }
                for r in result["items"]
            ],
        })
        
class DeviationViewSet(viewsets.ReadOnlyModelViewSet):
    """Отклонения от режима и нарушения порядка.
 
    Только чтение: записи создаёт разбор телеметрии. Человек
    не правит отклонение, а принимает по нему решение —
    это отдельная сущность.
    """
 
    queryset = Deviation.objects.select_related(
        "session", "session__equipment", "session__welder",
        "pass_run", "pass_run__run", "pass_run__run__weld",
        "pass_run__run__weld__instance",
        "pass_run__run__weld__instance__part",
        "pass_run__run__weld__seam",
        "pass_run__run__operation",
    )
    serializer_class = DeviationSerializer
 
    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
 
        # Два разных списка для двух разных людей.
        # scope=режим — очередь технолога: ток, напряжение, скорость.
        # scope=порядок — мастеру: сварка без карты, работа без допуска
        scope = params.get("scope")
        if scope == "режим":
            qs = qs.exclude(parameter__in=Deviation.ORGANIZATIONAL)
        elif scope == "порядок":
            qs = qs.filter(parameter__in=Deviation.ORGANIZATIONAL)
 
        # ждут решения — то, ради чего всё и сделано
        if params.get("pending") == "1":
            qs = qs.filter(reviewed=False)
 
        equipment = params.get("equipment")
        if equipment:
            qs = qs.filter(session__equipment_id=equipment)
 
        welder = params.get("welder")
        if welder:
            qs = qs.filter(session__welder_id=welder)
 
        workshop = params.get("workshop")
        if workshop:
            qs = qs.filter(
                session__equipment__workstation__section__workshop_id=workshop
            )
 
        weld = params.get("weld")
        if weld:
            qs = qs.filter(pass_run__run__weld_id=weld)
 
        run = params.get("run")
        if run:
            qs = qs.filter(pass_run__run_id=run)
 
        session = params.get("session")
        if session:
            qs = qs.filter(session_id=session)
 
        parameter = params.get("parameter")
        if parameter:
            qs = qs.filter(parameter=parameter)
 
        severity = params.get("severity")
        if severity:
            qs = qs.filter(severity=severity)
 
        if params.get("from"):
            qs = qs.filter(started_at__gte=params["from"])
        if params.get("to"):
            qs = qs.filter(started_at__lte=params["to"])
 
        return qs
 
    @action(detail=False, methods=["get"])
    def summary(self, request):
        """GET /api/deviations/summary/
 
        Счётчики для плитки «Отклонения» и для плашки мастера.
        """
        base = self.get_queryset()
 
        regime = base.exclude(parameter__in=Deviation.ORGANIZATIONAL)
        order = base.filter(parameter__in=Deviation.ORGANIZATIONAL)
 
        by_severity = dict(
            regime.values_list("severity").annotate(n=Count("id"))
        )
 
        return Response({
            "regime": {
                "total": regime.count(),
                "pending": regime.filter(reviewed=False).count(),
                "info": by_severity.get("замечание", 0),
                "warning": by_severity.get("предупреждение", 0),
                "critical": by_severity.get("нарушение", 0),
            },
            "order": {
                "total": order.count(),
                "pending": order.filter(reviewed=False).count(),
                "noCard": order.filter(parameter="без_карты").count(),
                "noAttestation": order.filter(parameter="без_допуска").count(),
            },
        })
 
 
class WeldDecisionViewSet(viewsets.ModelViewSet):
    """Решения по отклонениям.
 
    Ставить решение может только технолог или администратор:
    это подпись, а не заметка.
    """
 
    permission_classes = [permissions.IsAuthenticated, IsTechnologyEditor]
    queryset = WeldDecision.objects.select_related(
        "session", "session__equipment",
        "weld", "weld__instance", "weld__instance__part", "weld__seam",
        "run", "run__operation", "author",
    ).prefetch_related("deviations")
    serializer_class = WeldDecisionSerializer
 
    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
 
        for field in ("session", "weld", "run"):
            value = params.get(field)
            if value:
                qs = qs.filter(**{f"{field}_id": value})
 
        result = params.get("result")
        if result:
            qs = qs.filter(result=result)
 
        return qs
 
    def perform_create(self, serializer):
        """Автор — тот, кто вошёл.
 
        perform_create вызывается после проверки данных, но до записи.
        Здесь подставляется то, что клиент задать не может
        """
        serializer.save(author=self.request.user)
 
    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Как распределились принятые решения — для сводки."""
        taken = dict(
            self.get_queryset().values_list("result").annotate(n=Count("id"))
        )
        return Response({
            "allowed": taken.get("допущено", 0),
            "toControl": taken.get("на контроль", 0),
            "toRework": taken.get("на переварку", 0),
            "handled": taken.get("разобрано", 0),
        })    