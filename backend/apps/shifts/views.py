from datetime import date, timedelta

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .calendar import current_shift, time_fund
from .models import CalendarException, ShiftSchedule
from .serializers import CalendarExceptionSerializer, ShiftScheduleSerializer


class ShiftScheduleViewSet(viewsets.ModelViewSet):
    """Графики смен."""

    queryset = ShiftSchedule.objects.select_related("workshop").prefetch_related("days")
    serializer_class = ShiftScheduleSerializer

    @action(detail=False, methods=["get"])
    def current(self, request):
        """GET /api/shift-schedules/current/?workshop=3

        Какая смена идёт сейчас. Для плашки «текущая смена»
        на дашборде: сколько прошло, сколько осталось.
        """
        workshop = request.query_params.get("workshop")
        shift = current_shift(int(workshop) if workshop else None)

        if shift is None:
            return Response({"hasSchedule": False})

        plan = shift.plan
        return Response({
            "hasSchedule": True,
            "inShift": shift.in_shift,
            "onBreak": shift.on_break,
            "day": plan.day,
            "weekday": plan.day.weekday(),
            "isWorking": plan.is_working,
            "startsAt": plan.starts_at,
            "endsAt": plan.ends_at,
            "breakStart": plan.break_start,
            "breakEnd": plan.break_end,
            "fundSeconds": shift.fund_seconds,
            "elapsedSeconds": shift.elapsed_seconds,
            "remainingSeconds": shift.remaining_seconds,
            "progress": shift.progress,
            "comment": plan.comment,
        })

    @action(detail=False, methods=["get"])
    def fund(self, request):
        """GET /api/shift-schedules/fund/?from=2026-10-01&to=2026-10-31

        Фонд времени за период — знаменатель для Кз.
        Параметр elapsed=1 считает только прошедшую часть смен.
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
        # защита от запроса на сто лет: расчёт идёт по дням в Python
        if (date_to - date_from) > timedelta(days=740):
            return Response({"detail": "Период больше двух лет"}, status=400)

        workshop = params.get("workshop")
        result = time_fund(
            int(workshop) if workshop else None,
            date_from,
            date_to,
            only_elapsed=params.get("elapsed") == "1",
        )

        return Response({
            "seconds": result["seconds"],
            "hours": result["hours"],
            "workingDays": result["working_days"],
            "days": [
                {
                    "day": d.day,
                    "weekday": d.day.weekday(),
                    "isWorking": d.is_working,
                    "hours": d.work_hours,
                    "source": d.source,
                    "comment": d.comment,
                }
                for d in result["days"]
            ],
        })


class CalendarExceptionViewSet(viewsets.ModelViewSet):
    """Производственный календарь: праздники, переносы, сокращённые дни."""

    queryset = CalendarException.objects.select_related("schedule")
    serializer_class = CalendarExceptionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        year = params.get("year")
        if year:
            qs = qs.filter(day__year=year)

        kind = params.get("kind")
        if kind:
            qs = qs.filter(kind=kind)

        return qs