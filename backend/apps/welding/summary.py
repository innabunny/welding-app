"""Сводка по сварочному производству за период — главный экран телеметрии.

Здесь собираются все цифры для блоков «Загрузка оборудования»,
«Отклонения от режима», «Сварочные материалы», «Выполненные сварочные
работы» и «По типам оборудования». Фронт их только показывает:
два расчёта однажды разойдутся, поэтому считается всё здесь.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.utils import timezone

from apps.shifts.calendar import current_shift, work_intervals
from apps.shifts.intervals import intersect, total_seconds
from apps.welding.analysis import _mid

from .models import ArcRun, Deviation, NodeState, OperationRun, WeldDecision, WeldingSession
from .utilization import equipment_utilization

# Тип оборудования по процессу способа сварки — четыре группы, как в референсе
TYPE_OF_PROCESS = {
    "tig": "arc",
    "mig": "arc",
    "plasma": "arc",
    "contact": "contact",
    "ebw": "ebw",
    "laser": "ebw",
    "diff": "diff",
}
TYPES = ["arc", "contact", "ebw", "diff"]

# Подписи процессов в строках «Выполненных сварочных работ»
PROCESS_LABEL = {
    "tig": "TIG (неплавящимся электродом)",
    "mig": "MIG/MAG (плавящимся электродом)",
    "plasma": "Плазменная",
}

# Худший исход шва — по нему шов попадает в одну из групп качества
QUALITY_ORDER = ["без отклонений", "допущено", "на контроль", "не рассмотрено", "на переварку"]


@dataclass
class Filters:
    date_from: date
    date_to: date
    workshop: int | None = None
    type: str | None = None
    equipment: int | None = None
    welder: int | None = None


def _bounds(f: Filters) -> tuple[datetime, datetime]:
    """Период как два момента в местном поясе: [начало первого дня, начало дня после последнего)."""
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(f.date_from, datetime.min.time()), tz)
    end = timezone.make_aware(datetime.combine(f.date_to + timedelta(days=1), datetime.min.time()), tz)
    return start, end


def _equipment(f: Filters, qs):
    """Оборудование под фильтр. Тип — по процессу способа сварки."""
    if f.workshop:
        qs = qs.filter(workstation__section__workshop_id=f.workshop)
    if f.equipment:
        qs = qs.filter(id=f.equipment)
    items = list(qs)
    if f.type:
        items = [e for e in items if _type(e) == f.type]
    return items


def _type(equipment) -> str | None:
    method = equipment.method
    return TYPE_OF_PROCESS.get(method.process) if method else None


# ───────────────────── загрузка ─────────────────────

def load_block(f: Filters, equipment, now: datetime) -> dict:
    """Кз и раскладка фонда времени.

    Фонд — полная смена по графику, прошедшая и оставшаяся части
    отдельно. Проценты и Кз — от прошедшей части: в десять утра
    делить на полную смену бессмысленно.
    """
    by_type: dict[str, dict] = {t: _empty_load() for t in TYPES}
    total = _empty_load()
    # график смен читается один раз на цех — это самая долгая часть расчёта
    shifts: dict[int | None, list] = {}
    daily_fund: dict[date, int] = defaultdict(int)
    daily_arc: dict[date, int] = defaultdict(int)

    for eq in equipment:
        workshop = eq.workshop.id if eq.workshop else None
        if workshop not in shifts:
            shifts[workshop] = work_intervals(workshop, f.date_from, f.date_to)
        full_shift = shifts[workshop]
        now_shift = [(s, min(e, now)) for s, e in full_shift if s < now]

        u_full = equipment_utilization(eq, f.date_from, f.date_to, shift=full_shift)
        u_now = equipment_utilization(eq, f.date_from, f.date_to, until=now, shift=now_shift)
        for bucket in (total, by_type.setdefault(_type(eq) or "arc", _empty_load())):
            bucket["fundSeconds"] += u_full.fund_seconds
            bucket["elapsedSeconds"] += u_now.fund_seconds
            bucket["arcSeconds"] += u_now.arc_seconds
            bucket["standbySeconds"] += u_now.standby_seconds
            bucket["idleSeconds"] += u_now.idle_seconds
            bucket["noDataSeconds"] += u_now.no_data_seconds

        # Кз по дням: прошедшие рабочие отрезки дня и дуга внутри них
        for s, e in now_shift:
            day = timezone.localtime(s).date()
            daily_fund[day] += round((e - s).total_seconds())
            daily_arc[day] += total_seconds(intersect(u_now.arc_intervals, [(s, e)]))

    for bucket in [total, *by_type.values()]:
        _finish_load(bucket)

    daily = []
    if f.date_to > f.date_from:
        daily = [
            {"date": d, "kz": round(daily_arc[d] / fund, 4), "arcSeconds": daily_arc[d], "fundSeconds": fund}
            for d, fund in sorted(daily_fund.items())
            if fund
        ]

    shift = None
    if f.date_from == f.date_to == now.date():
        workshop = equipment[0].workshop.id if equipment and equipment[0].workshop else None
        s = current_shift(workshop, now)
        if s and s.plan.is_working and s.plan.starts_at and s.plan.ends_at:
            shift = {
                "startsAt": s.plan.starts_at.strftime("%H:%M"),
                "endsAt": s.plan.ends_at.strftime("%H:%M"),
                "elapsedSeconds": s.elapsed_seconds,
                "fundSeconds": s.fund_seconds,
                "inShift": s.in_shift,
                "onBreak": s.on_break,
            }

    return {
        **total,
        "remainingSeconds": max(total["fundSeconds"] - total["elapsedSeconds"], 0),
        "equipmentCount": len(equipment),
        "daily": daily,
        "shift": shift,
        "byType": by_type,
    }


def _empty_load() -> dict:
    return {
        "fundSeconds": 0, "elapsedSeconds": 0, "arcSeconds": 0,
        "standbySeconds": 0, "idleSeconds": 0, "noDataSeconds": 0,
    }


def _finish_load(b: dict) -> None:
    """Кз — время горения дуги от прошедшей части фонда."""
    b["kz"] = round(b["arcSeconds"] / b["elapsedSeconds"], 4) if b["elapsedSeconds"] else 0.0


# ───────────────────── отклонения ─────────────────────

def deviations_block(f: Filters, equipment_ids: list[int]) -> dict:
    """Отклонения режима за период: сколько разобрано, по способам, последние."""
    start, end = _bounds(f)
    qs = Deviation.objects.filter(
        session__equipment_id__in=equipment_ids,
        started_at__gte=start, started_at__lt=end,
    ).exclude(parameter__in=[Deviation.Parameter.NO_CARD, Deviation.Parameter.NO_ATTESTATION])
    if f.welder:
        qs = qs.filter(session__welder_id=f.welder)
    qs = qs.select_related("session__equipment__method").order_by("-started_at")

    rows = list(qs)
    by_method: dict[str, dict] = {}
    for d in rows:
        m = d.session.equipment.method
        key = (m.designation or m.name) if m else "—"
        item = by_method.setdefault(key, {"method": key, "type": _type(d.session.equipment) or "arc", "count": 0})
        item["count"] += 1

    pending = sum(1 for d in rows if not d.reviewed)
    return {
        "total": len(rows),
        "analyzed": len(rows) - pending,
        "pending": pending,
        "byMethod": sorted(by_method.values(), key=lambda x: -x["count"]),
        "latest": [
            {
                "id": d.id,
                "startedAt": d.started_at,
                "equipmentName": d.session.equipment.name,
                "parameter": d.parameter,
                "parameterName": d.get_parameter_display(),
                "actualValue": d.actual_value,
                "plannedMin": d.planned_min,
                "plannedMax": d.planned_max,
                "reviewed": d.reviewed,
            }
            for d in rows[:4]
        ],
    }


# ───────────────────── материалы ─────────────────────

def materials_block(f: Filters, equipment_ids: list[int]) -> list[dict]:
    """Расход материалов — ОЦЕНКА: время горения дуги × норма из техкарты.

    Та же формула, что в analysis.estimate_consumption, но без записи
    в базу: сводку читают, а не пересчитывают.
    """
    start, end = _bounds(f)
    runs = OperationRun.objects.filter(
        equipment_id__in=equipment_ids, started_at__gte=start, started_at__lt=end,
    ).select_related("card__method", "card__shield_gas", "card__backing_gas", "card__plasma_gas", "card__filler")
    if f.welder:
        runs = runs.filter(welder_id=f.welder)

    totals: dict[tuple[str, str], Decimal] = defaultdict(Decimal)
    for run in runs:
        card = run.card
        mechanized = card.method.process in ("mig", "plasma")
        for p in run.passes.select_related("planned_pass").all():
            planned = p.planned_pass
            if not planned or not p.arc_time:
                continue
            minutes = Decimal(p.arc_time.total_seconds()) / Decimal(60)
            # газ — литры за минуту, в сводке кубометры
            for name, flow in (
                (_name(card.shield_gas, card.shield_gas_text), _mid(planned.gas_flow_min, planned.gas_flow_max)),
                (_name(card.backing_gas, card.backing_gas_text), _mid(planned.backing_flow_min, planned.backing_flow_max)),
                (_name(card.plasma_gas, card.plasma_gas_text), _mid(planned.plasma_flow_min, planned.plasma_flow_max)),
            ):
                if name and flow:
                    totals[(name, "м³")] += minutes * flow / 1000
            if mechanized:
                wire = _mid(planned.wire_speed_min, planned.wire_speed_max)
                if wire:
                    totals[(_name(card.filler, card.filler_text) or "Сварочная проволока", "м")] += minutes * wire

    return [
        {"name": name, "unit": unit, "amount": round(float(v), 1)}
        for (name, unit), v in sorted(totals.items(), key=lambda kv: -kv[1])
    ]


def _name(obj, snapshot: str) -> str:
    return snapshot or (str(obj) if obj else "")


# ───────────────────── выполненные работы ─────────────────────

def works_block(f: Filters, equipment, now: datetime) -> dict:
    """Выполненные сварочные работы по каждому типу оборудования."""
    start, end = _bounds(f)
    type_of_eq = {e.id: _type(e) or "arc" for e in equipment}
    ids = list(type_of_eq)

    runs = OperationRun.objects.filter(
        equipment_id__in=ids, started_at__lt=end,
    ).exclude(finished_at__lt=start).select_related("weld__seam", "weld__instance", "card__method")
    if f.welder:
        runs = runs.filter(welder_id=f.welder)
    runs = list(runs)

    # исход шва: худший из решений по его отклонениям
    weld_ids = {r.weld_id for r in runs}
    devs_by_weld: dict[int, list[Deviation]] = defaultdict(list)
    for d in Deviation.objects.filter(pass_run__run__weld_id__in=weld_ids).exclude(
        parameter__in=[Deviation.Parameter.NO_CARD, Deviation.Parameter.NO_ATTESTATION]
    ).select_related("pass_run__run"):
        devs_by_weld[d.pass_run.run.weld_id].append(d)
    result_of: dict[int, str] = {}
    for dec in WeldDecision.objects.filter(deviations__pass_run__run__weld_id__in=weld_ids).prefetch_related("deviations"):
        for d in dec.deviations.all():
            result_of[d.id] = dec.result

    out = {}
    for t in TYPES:
        mine = [r for r in runs if type_of_eq.get(r.equipment_id) == t]
        done = [r for r in mine if r.status == OperationRun.Status.DONE and r.finished_at and start <= r.finished_at < end]
        welds = {r.weld_id: r for r in done}
        length_mm = sum((r.weld.seam.seam_length or 0) for r in welds.values())

        by_process: dict[str, dict] = {}
        for r in welds.values():
            proc = r.card.method.process if r.card and r.card.method else ""
            if proc not in PROCESS_LABEL:
                continue
            row = by_process.setdefault(proc, {"process": proc, "label": PROCESS_LABEL[proc], "seams": 0, "lengthM": 0.0})
            row["seams"] += 1
            row["lengthM"] += float(r.weld.seam.seam_length or 0) / 1000

        quality = {k: 0 for k in QUALITY_ORDER}
        for weld_id in welds:
            quality[_weld_outcome(devs_by_weld.get(weld_id, []), result_of)] += 1

        daily = defaultdict(lambda: {"seams": 0, "lengthM": 0.0})
        for r in welds.values():
            day = timezone.localtime(r.finished_at).date()
            daily[day]["seams"] += 1
            daily[day]["lengthM"] += float(r.weld.seam.seam_length or 0) / 1000

        out[t] = {
            "seams": len(welds),
            "lengthM": round(float(length_mm) / 1000, 1),
            "parts": len({r.weld.instance_id for r in mine}),
            "partsFinished": len({r.weld.instance_id for r in done}),
            "inProgress": sum(1 for r in mine if r.status == OperationRun.Status.IN_WORK),
            "byProcess": [{**v, "lengthM": round(v["lengthM"], 1)} for v in by_process.values()],
            "joints": len(welds),
            "quality": quality,
            "coverage": _coverage(f, [i for i, tt in type_of_eq.items() if tt == t]),
            "daily": [
                {"date": d, "seams": v["seams"], "lengthM": round(v["lengthM"], 1)}
                for d, v in sorted(daily.items())
            ],
        }
    return out


def _weld_outcome(devs: list[Deviation], result_of: dict[int, str]) -> str:
    """Группа шва по худшему исходу его отклонений."""
    worst = "без отклонений"
    for d in devs:
        res = result_of.get(d.id, "не рассмотрено")
        if res not in QUALITY_ORDER:
            res = "допущено"
        if QUALITY_ORDER.index(res) > QUALITY_ORDER.index(worst):
            worst = res
    return worst


def _coverage(f: Filters, equipment_ids: list[int]) -> dict:
    """Время горения дуги по режимам: по техкартам, отработка, прихватка, без техкарты."""
    start, end = _bounds(f)
    secs = {"techSeconds": 0, "trialSeconds": 0, "tackSeconds": 0, "noCardSeconds": 0}
    arcs = ArcRun.objects.filter(
        session__equipment_id__in=equipment_ids, started_at__gte=start, started_at__lt=end,
    ).select_related("session")
    if f.welder:
        arcs = arcs.filter(session__welder_id=f.welder)
    now = timezone.now()
    for a in arcs:
        dur = ((a.finished_at or now) - a.started_at).total_seconds()
        s = a.session
        if s.mode == WeldingSession.Mode.TRIAL:
            secs["trialSeconds"] += dur
        elif s.mode == WeldingSession.Mode.TACK:
            secs["tackSeconds"] += dur
        elif s.operation_run_id:
            secs["techSeconds"] += dur
        else:
            secs["noCardSeconds"] += dur
    secs = {k: round(v) for k, v in secs.items()}
    secs["totalSeconds"] = sum(secs.values())
    return secs


# ───────────────────── по типам оборудования ─────────────────────

def types_block(f: Filters, equipment, load: dict) -> list[dict]:
    """Карточки «Дуговая / Контактная / Электронно-лучевая / Диффузионная»."""
    start, end = _bounds(f)
    online = dict(NodeState.objects.filter(equipment_id__isnull=False).values_list("equipment_id", "is_online"))
    open_eq = set(WeldingSession.objects.filter(finished_at__isnull=True).values_list("equipment_id", flat=True))
    devs = Deviation.objects.filter(
        started_at__gte=start, started_at__lt=end,
    ).exclude(parameter__in=[Deviation.Parameter.NO_CARD, Deviation.Parameter.NO_ATTESTATION])

    out = []
    for t in TYPES:
        mine = [e for e in equipment if (_type(e) or "arc") == t]
        ids = [e.id for e in mine]
        d = devs.filter(session__equipment_id__in=ids)
        out.append({
            "type": t,
            "units": len(mine),
            "activeNow": sum(1 for i in ids if i in open_eq),
            "offline": sum(1 for e in mine if e.node_id and not online.get(e.id, False)),
            **load["byType"].get(t, _empty_load()),
            "deviations": d.count(),
            "unreviewed": d.filter(reviewed=False).count(),
        })
    return out


def build_summary(f: Filters, equipment_qs) -> dict:
    now = timezone.localtime()
    equipment = _equipment(f, equipment_qs)
    ids = [e.id for e in equipment]
    load = load_block(f, equipment, now)
    return {
        "from": f.date_from,
        "to": f.date_to,
        "load": {k: v for k, v in load.items() if k != "byType"},
        "deviations": deviations_block(f, ids),
        "materials": materials_block(f, ids),
        "works": works_block(f, equipment, now),
        "types": types_block(f, equipment, load),
    }
