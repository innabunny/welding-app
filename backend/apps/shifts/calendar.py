# Расчёты по графику: какая смена идёт сейчас и каков фонд времени.
#
# Здесь нет ни одной записи в базу — только чтение и арифметика.
# Такие модули удобно проверять: подставил дату, получил число.

from dataclasses import dataclass
from datetime import date as date_cls
from datetime import datetime, time, timedelta
from .intervals import Interval, merge

from django.db.models import Q
from django.utils import timezone

from .models import CalendarException, ShiftDay, ShiftSchedule


@dataclass
class DayPlan:
    """Что планировалось на конкретную дату по конкретному графику."""

    day: date_cls
    is_working: bool
    starts_at: time | None
    ends_at: time | None
    break_start: time | None
    break_end: time | None
    # откуда взялось: обычный день недели или исключение календаря
    source: str
    comment: str = ""

    @property
    def work_seconds(self) -> int:
        """Рабочее время без обеда, в секундах."""
        if not self.is_working or not self.starts_at or not self.ends_at:
            return 0
        total = _between(self.starts_at, self.ends_at)
        if self.break_start and self.break_end:
            total -= _between(self.break_start, self.break_end)
        return max(total, 0)

    @property
    def work_hours(self) -> float:
        return round(self.work_seconds / 3600, 2)


def schedule_for(workshop_id: int | None, day: date_cls) -> ShiftSchedule | None:
    """Найти график цеха на дату.

    Сначала ищем график самого цеха. Не нашли — берём график
    по умолчанию (тот, у которого цех не указан). Так производственные
    цеха с одинаковыми часами обслуживаются одной записью.
    """
    qs = ShiftSchedule.objects.filter(number=1)

    if workshop_id is not None:
        own = [s for s in qs.filter(workshop_id=workshop_id) if s.is_active_on(day)]
        if own:
            return own[0]

    common = [s for s in qs.filter(workshop__isnull=True) if s.is_active_on(day)]
    return common[0] if common else None


def plan_for_day(schedule: ShiftSchedule, day: date_cls) -> DayPlan:
    """Что планировалось на эту дату.

    Порядок важен: сначала смотрим исключения календаря, и только
    если их нет — обычный день недели. Иначе праздник потеряется.
    """
    # Исключение для этого графика важнее общезаводского, поэтому
    # сортируем так, чтобы адресное шло первым
    exc = (
        CalendarException.objects.filter(day=day)
        .filter(Q(schedule=schedule) | Q(schedule__isnull=True))
        .order_by("-schedule_id")
        .first()
    )

    weekday_row = ShiftDay.objects.filter(
        schedule=schedule, weekday=day.weekday()
    ).first()

    if exc is not None:
        if exc.kind == "нерабочий":
            return DayPlan(day, False, None, None, None, None, "календарь", exc.comment)

        # рабочий или сокращённый: время из исключения, а чего там
        # нет — из обычного дня недели
        base = weekday_row
        return DayPlan(
            day=day,
            is_working=True,
            starts_at=exc.starts_at or (base.starts_at if base else None),
            ends_at=exc.ends_at or (base.ends_at if base else None),
            break_start=exc.break_start or (base.break_start if base else None),
            break_end=exc.break_end or (base.break_end if base else None),
            source="календарь",
            comment=exc.comment,
        )

    if weekday_row is None or not weekday_row.is_working:
        return DayPlan(day, False, None, None, None, None, "график")

    return DayPlan(
        day=day,
        is_working=True,
        starts_at=weekday_row.starts_at,
        ends_at=weekday_row.ends_at,
        break_start=weekday_row.break_start,
        break_end=weekday_row.break_end,
        source="график",
    )


@dataclass
class ShiftNow:
    """Состояние смены в данный момент."""

    in_shift: bool          # идёт ли смена прямо сейчас
    on_break: bool          # обед
    plan: DayPlan
    elapsed_seconds: int    # рабочих секунд прошло
    remaining_seconds: int  # рабочих секунд осталось

    @property
    def fund_seconds(self) -> int:
        return self.plan.work_seconds

    @property
    def progress(self) -> float:
        """Доля смены, которая уже прошла, от 0 до 1."""
        if not self.fund_seconds:
            return 0.0
        return round(self.elapsed_seconds / self.fund_seconds, 3)


def current_shift(workshop_id: int | None, now: datetime | None = None) -> ShiftNow | None:
    """Какая смена идёт сейчас и сколько от неё осталось.

    Возвращает None, если на цех нет графика. Если сейчас выходной
    или ночь, вернётся ShiftNow с in_shift=False — это не ошибка,
    а ответ «смена не идёт», и дашборд должен его показать,
    а не считать Кз от нуля.
    """
    now = now or timezone.localtime()
    day = now.date()

    schedule = schedule_for(workshop_id, day)
    if schedule is None:
        return None

    plan = plan_for_day(schedule, day)
    if not plan.is_working or not plan.starts_at or not plan.ends_at:
        return ShiftNow(False, False, plan, 0, 0)

    t = now.time()

    if t < plan.starts_at:
        # смена ещё не началась
        return ShiftNow(False, False, plan, 0, plan.work_seconds)
    if t >= plan.ends_at:
        # смена закончилась: прошло всё
        return ShiftNow(False, False, plan, plan.work_seconds, 0)

    on_break = bool(
        plan.break_start and plan.break_end and plan.break_start <= t < plan.break_end
    )

    elapsed = _between(plan.starts_at, t)
    # вычитаем обед, но только ту его часть, которая уже прошла
    if plan.break_start and plan.break_end:
        if t >= plan.break_end:
            elapsed -= _between(plan.break_start, plan.break_end)
        elif t > plan.break_start:
            elapsed -= _between(plan.break_start, t)
    elapsed = max(elapsed, 0)

    return ShiftNow(
        in_shift=not on_break,
        on_break=on_break,
        plan=plan,
        elapsed_seconds=elapsed,
        remaining_seconds=max(plan.work_seconds - elapsed, 0),
    )


def time_fund(
    workshop_id: int | None,
    date_from: date_cls,
    date_to: date_cls,
    *,
    only_elapsed: bool = False,
    now: datetime | None = None,
) -> dict:
    """Фонд времени за период — знаменатель для Кз.

    only_elapsed=True считает не всю смену, а лишь прошедшую её часть.
    Это нужно для сводки за текущий день: в десять утра делить время
    горения дуги на полную смену бессмысленно, Кз выйдет вдвое ниже.
    """
    now = now or timezone.localtime()
    today = now.date()

    total = 0
    working_days = 0
    days: list[DayPlan] = []

    day = date_from
    while day <= date_to:
        schedule = schedule_for(workshop_id, day)
        if schedule is None:
            day += timedelta(days=1)
            continue

        plan = plan_for_day(schedule, day)
        days.append(plan)

        if plan.is_working:
            working_days += 1
            seconds = plan.work_seconds

            if only_elapsed and day == today:
                shift = current_shift(workshop_id, now)
                seconds = shift.elapsed_seconds if shift else 0
            elif only_elapsed and day > today:
                seconds = 0   # будущие дни в прошедший фонд не идут

            total += seconds

        day += timedelta(days=1)

    return {
        "seconds": total,
        "hours": round(total / 3600, 2),
        "working_days": working_days,
        "days": days,
    }


def _between(a: time, b: time) -> int:
    """Секунды между двумя временами одних суток."""
    base = date_cls(2000, 1, 1)
    return int((datetime.combine(base, b) - datetime.combine(base, a)).total_seconds())

def work_intervals(
    workshop_id: int | None,
    date_from: date_cls,
    date_to: date_cls,
) -> list[Interval]:
    """Рабочие отрезки за период, с вырезанными обедами.
 
    Один рабочий день даёт один или два отрезка: без обеда — один,
    с обедом — два (до и после). Выходные и праздники не дают ничего.
 
    Время возвращается с зоной, как его хранит база, иначе сравнение
    с временем из телеметрии даст ошибку «can't compare offset-naive
    and offset-aware datetimes».
    """
    spans: list[Interval] = []
    tz = timezone.get_current_timezone()
 
    day = date_from
    while day <= date_to:
        schedule = schedule_for(workshop_id, day)
        if schedule is None:
            day += timedelta(days=1)
            continue
 
        plan = plan_for_day(schedule, day)
        if not plan.is_working or not plan.starts_at or not plan.ends_at:
            day += timedelta(days=1)
            continue
 
        # make_aware привязывает «часы на циферблате» к часовому поясу:
        # 07:15 становится 07:15 по Москве, то есть 04:15 UTC
        start = timezone.make_aware(datetime.combine(day, plan.starts_at), tz)
        end = timezone.make_aware(datetime.combine(day, plan.ends_at), tz)
 
        if plan.break_start and plan.break_end:
            b_start = timezone.make_aware(datetime.combine(day, plan.break_start), tz)
            b_end = timezone.make_aware(datetime.combine(day, plan.break_end), tz)
            spans.append((start, b_start))
            spans.append((b_end, end))
        else:
            spans.append((start, end))
 
        day += timedelta(days=1)
 
    return merge(spans)