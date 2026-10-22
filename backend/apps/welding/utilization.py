# Коэффициент загрузки оборудования (Кз) и раскладка фонда времени.
#
# Главная мысль: Кз нельзя получить простым делением. Время дуги
# надо пересечь с рабочим временем смены, иначе сварка в обед или
# вечером попадёт в числитель и Кз выйдет больше ста процентов.
#
# Фонд раскладывается на четыре части, и в сумме они дают ровно фонд:
#   горение дуги   — из ArcRun
#   режим ожидания — сеанс открыт, дуги нет
#   нет данных     — узел был не на связи
#   простой        — всё остальное

from dataclasses import dataclass, field
from datetime import date as date_cls
from datetime import datetime, time, timedelta

from django.utils import timezone

from apps.shifts.calendar import work_intervals
from apps.shifts.intervals import (
    Interval,
    clip,
    intersect,
    merge,
    subtract,
    total_seconds,
)

from .models import ArcRun, NodeOutage, WeldingSession


@dataclass
class Utilization:
    """Раскладка времени по одному аппарату за период."""

    equipment_id: int
    equipment_name: str

    fund_seconds: int          # сколько должен был работать по графику
    arc_seconds: int           # горела дуга
    standby_seconds: int       # сеанс открыт, дуги нет
    no_data_seconds: int       # узел молчал
    idle_seconds: int          # простой

    # сварка вне смены: вечером, в обед, в выходной. В фонд не входит,
    # но знать о ней надо — это либо сверхурочные, либо нарушение
    outside_shift_seconds: int = 0

    sessions: int = 0
    arcs: int = 0

    @property
    def available_seconds(self) -> int:
        """Фонд, за который у нас есть данные."""
        return max(self.fund_seconds - self.no_data_seconds, 0)

    @property
    def kz(self) -> float:
        """Кз от полного фонда — для отчёта.

        Если узел молчал полдня, Кз будет низким. Это честно:
        мы не можем утверждать, что оборудование работало.
        """
        if not self.fund_seconds:
            return 0.0
        return round(self.arc_seconds / self.fund_seconds, 4)

    @property
    def kz_available(self) -> float:
        """Кз от наблюдаемого фонда — для технолога.

        Отвечает на вопрос «как использовалось то время,
        которое мы действительно видели».
        """
        if not self.available_seconds:
            return 0.0
        return round(self.arc_seconds / self.available_seconds, 4)

    @property
    def balance_error_seconds(self) -> int:
        """Расхождение суммы частей с фондом.

        Должно быть нулём. Если нет — где-то пересекающиеся отрезки
        или дыра в расчёте. Такое надо видеть, а не замазывать.
        """
        parts = (
            self.arc_seconds
            + self.standby_seconds
            + self.no_data_seconds
            + self.idle_seconds
        )
        return self.fund_seconds - parts


def equipment_utilization(
    equipment,
    date_from: date_cls,
    date_to: date_cls,
    *,
    until: datetime | None = None,
) -> Utilization:
    """Посчитать раскладку времени по одному аппарату.

    until — не считать позже этого момента. Нужно для текущего дня:
    в десять утра делить на полную смену бессмысленно, Кз выйдет
    вдвое ниже реального. Передаётся «сейчас».
    """
    workshop = equipment.workshop
    workshop_id = workshop.id if workshop else None

    shift = work_intervals(workshop_id, date_from, date_to)

    if until is not None:
        # обрезаем рабочее время по текущему моменту
        shift = [(s, min(e, until)) for s, e in shift if s < until]

    if not shift:
        return Utilization(equipment.id, equipment.name, 0, 0, 0, 0, 0)

    period_from, period_to = shift[0][0], shift[-1][1]
    fund = total_seconds(shift)

    # --- дуга ---
    arc_rows = ArcRun.objects.filter(
        session__equipment=equipment,
        started_at__lt=period_to,
        finished_at__gt=period_from,
    ).values_list("started_at", "finished_at")

    # finished_at бывает пустым: сварка идёт прямо сейчас или узел
    # оборвался и конец участка не пришёл. Берём до конца периода
    arc_spans = merge([(s, e or period_to) for s, e in arc_rows if s])
    arc_in_shift = intersect(arc_spans, shift)

    # --- сеансы ---
    session_rows = WeldingSession.objects.filter(
        equipment=equipment,
        started_at__lt=period_to,
    ).values_list("started_at", "finished_at")

    session_spans = merge([
        (s, e or period_to) for s, e in session_rows
        if s and (e is None or e > period_from)
    ])
    session_in_shift = intersect(session_spans, shift)

    # --- обрывы связи ---
    outage_spans: list[Interval] = []
    if equipment.node_id:
        outage_rows = NodeOutage.objects.filter(
            node__node_id=equipment.node_id,
            started_at__lt=period_to,
        ).values_list("started_at", "finished_at")
        outage_spans = merge(
            clip(
                [(s, e or period_to) for s, e in outage_rows if s],
                period_from,
                period_to,
            )
        )
    outage_in_shift = intersect(outage_spans, shift)

    # Обрыв важнее остального: если связи не было, мы не знаем,
    # варили или нет. Поэтому дугу и сеансы считаем только там,
    # где данные были
    observed = subtract(shift, outage_in_shift)
    arc_final = intersect(arc_in_shift, observed)
    session_final = intersect(session_in_shift, observed)

    arc_sec = total_seconds(arc_final)
    # ожидание — это сеанс без дуги внутри него
    standby_sec = total_seconds(subtract(session_final, arc_final))
    no_data_sec = total_seconds(outage_in_shift)

    # простой — наблюдаемое время, где не было ни сеанса, ни дуги
    idle_sec = total_seconds(subtract(observed, merge(session_final + arc_final)))

    # сварка вне смены: вся дуга минус та, что попала в смену
    outside_sec = total_seconds(subtract(clip(arc_spans, period_from, period_to), shift))

    return Utilization(
        equipment_id=equipment.id,
        equipment_name=equipment.name,
        fund_seconds=fund,
        arc_seconds=arc_sec,
        standby_seconds=standby_sec,
        no_data_seconds=no_data_sec,
        idle_seconds=idle_sec,
        outside_shift_seconds=outside_sec,
        sessions=len(session_spans),
        arcs=len(arc_spans),
    )


def fleet_utilization(
    equipment_qs,
    date_from: date_cls,
    date_to: date_cls,
    *,
    until: datetime | None = None,
) -> dict:
    """Раскладка по набору оборудования плюс итог.

    Итоговый Кз считается по сумме, а не как среднее от Кз аппаратов:
    среднее завысит показатель, если один аппарат работал час из часа,
    а другой — ноль из смены.
    """
    rows = [
        equipment_utilization(eq, date_from, date_to, until=until)
        for eq in equipment_qs
    ]

    fund = sum(r.fund_seconds for r in rows)
    arc = sum(r.arc_seconds for r in rows)
    no_data = sum(r.no_data_seconds for r in rows)
    available = max(fund - no_data, 0)

    return {
        "items": rows,
        "fund_seconds": fund,
        "arc_seconds": arc,
        "standby_seconds": sum(r.standby_seconds for r in rows),
        "no_data_seconds": no_data,
        "idle_seconds": sum(r.idle_seconds for r in rows),
        "outside_shift_seconds": sum(r.outside_shift_seconds for r in rows),
        "kz": round(arc / fund, 4) if fund else 0.0,
        "kz_available": round(arc / available, 4) if available else 0.0,
        "equipment_count": len(rows),
    }