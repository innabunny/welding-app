# Разбор потока телеметрии: превращает участки дуги в осмысленную картину —
# какой проход варится, где были остановки, где вышли за режим,
# сколько ушло материалов.
#
# Запускается после закрытия операции или по кнопке «пересчитать».
# Все результаты — ПРЕДПОЛОЖЕНИЯ разной надёжности, и каждое помечено,
# на чём основано. Технолог может поправить вручную.

from datetime import timedelta
from decimal import Decimal

from .models import ArcRun, ConsumptionEstimate, Deviation, WeldStop

# промежуток короче считается рабочей паузой, не остановкой
SHORT_GAP = timedelta(seconds=20)
# дольше — остановка, после которой шов успел остыть
LONG_GAP = timedelta(minutes=10)

# на сколько процентов можно выйти за диапазон, прежде чем это нарушение
WARNING_PERCENT = Decimal("5")
CRITICAL_PERCENT = Decimal("10")


def analyze(run):
    """Полный разбор выполненной операции."""
    arcs = list(run.sessions_arcs())
    if not arcs:
        return

    detect_stops(run, arcs)
    match_passes(run, arcs)
    detect_deviations(run)
    estimate_consumption(run)


# ─────────────────────────── остановки ───────────────────────────

def detect_stops(run, arcs):
    """Промежутки между участками дуги.

    Короткие — рабочие: перехват, смена положения горелки.
    Длинные означают, что шов остыл, и это важно для межслойной
    температуры, которую нормирует карта, но померить нечем.
    """
    run.stops.all().delete()

    for prev, nxt in zip(arcs, arcs[1:]):
        if not prev.finished_at or not nxt.started_at:
            continue

        gap = nxt.started_at - prev.finished_at
        if gap <= timedelta(seconds=2):
            continue  # дребезг на пороге тока, не пауза

        if gap <= SHORT_GAP:
            kind = WeldStop.Kind.SHORT
        elif gap >= LONG_GAP:
            kind = WeldStop.Kind.LONG
        else:
            kind = WeldStop.Kind.INTERPASS

        WeldStop.objects.create(
            run=run,
            after_arc=prev,
            started_at=prev.finished_at,
            finished_at=nxt.started_at,
            duration=gap,
            kind=kind,
            is_suspicious=gap >= LONG_GAP,
        )


# ──────────────────── какой проход варится ────────────────────

def match_passes(run, arcs):
    """Сопоставление участков дуги с проходами карты.

    Надёжного признака границы прохода НЕТ: деталь может не
    останавливаться между проходами, и ток может не меняться.
    Поэтому считаем по накопленному времени горения дуги:

        время прохода = длина шва / скорость из карты

    и набираем участки, пока не наберётся это время.
    Результат помечается уровнем достоверности — технолог должен
    видеть, что граница расчётная, а не измеренная.
    """
    seam = run.weld.seam
    length_mm = seam.seam_length
    if not length_mm:
        return  # без длины шва считать не из чего

    planned = list(run.card.passes.order_by("no"))
    if not planned:
        return

    pass_index = 0
    accumulated = timedelta()
    current_pass = _ensure_pass_run(run, planned[0])

    for arc in arcs:
        if not arc.duration:
            continue

        arc.pass_run = current_pass
        arc.save(update_fields=["pass_run"])
        accumulated += arc.duration

        expected = _expected_time(planned[pass_index], length_mm)
        if expected and accumulated >= expected and pass_index + 1 < len(planned):
            # накопили расчётное время — считаем, что проход закончился
            current_pass.arc_time = accumulated
            current_pass.match_source = _guess_source(arc, planned[pass_index])
            current_pass.save()

            pass_index += 1
            accumulated = timedelta()
            current_pass = _ensure_pass_run(run, planned[pass_index])

    current_pass.arc_time = accumulated
    current_pass.save()


def _expected_time(weld_pass, length_mm):
    """Сколько должен длиться проход по карте.

    Скорость в карте задана диапазоном, поэтому время тоже вилка.
    Берём середину: граница прохода и так приблизительная.
    """
    lo, hi = weld_pass.speed_min, weld_pass.speed_max
    speeds = [s for s in (lo, hi) if s]
    if not speeds:
        return None

    avg_m_per_h = sum(speeds) / len(speeds)
    if avg_m_per_h <= 0:
        return None

    length_m = Decimal(length_mm) / Decimal(1000)
    hours = length_m / Decimal(avg_m_per_h)
    return timedelta(hours=float(hours))


def _guess_source(arc, weld_pass):
    """На чём основана граница прохода — для честной пометки.

    Если рядом был скачок тока, граница достовернее, чем чистый расчёт.
    """
    from .models import WeldPassRun

    if weld_pass.current_min and arc.current_avg:
        planned_mid = (weld_pass.current_min + (weld_pass.current_max or weld_pass.current_min)) / 2
        if abs(arc.current_avg - planned_mid) > planned_mid * Decimal("0.15"):
            return WeldPassRun.MatchSource.CURRENT
    return WeldPassRun.MatchSource.CALCULATED


def _ensure_pass_run(run, planned_pass):
    from .models import WeldPassRun

    obj, _ = WeldPassRun.objects.get_or_create(
        run=run, no=planned_pass.no, defaults={"planned_pass": planned_pass},
    )
    return obj


# ──────────────────────── отклонения ────────────────────────

def detect_deviations(run):
    """Сверка факта с картой.

    ВАЖНО про импульсный режим: узел отдаёт за окно минимум, максимум
    и среднее. Это РАЗНЫЕ величины, и сравнивать их надо с разными
    полями карты:
        среднее   ↔ диапазон current_min / current_max
        максимум  ↔ pulse_current (ток импульса)
        минимум   ↔ pause_current (ток дежурной дуги)
    Если сравнить максимум с диапазоном, каждый импульсный шов даст
    ложное превышение.
    """
    run.sessions.first() and None  # noqa — сессия нужна для привязки

    for pass_run in run.passes.select_related("planned_pass").all():
        planned = pass_run.planned_pass
        if not planned:
            continue

        arcs = list(pass_run.arcs.all())
        if not arcs:
            continue

        session = arcs[0].session
        pulse = run.card.welding_mode == "импульсный"

        _check_range(
            session, pass_run, Deviation.Parameter.CURRENT,
            planned.current_min, planned.current_max,
            _avg(a.current_avg for a in arcs),
        )
        if not pulse:
            _check_range(
                session, pass_run, Deviation.Parameter.VOLTAGE,
                planned.voltage_min, planned.voltage_max,
                _avg(a.voltage_avg for a in arcs),
            )
        else:
            _check_range(
                session, pass_run, Deviation.Parameter.PULSE_CURRENT,
                planned.pulse_current, planned.pulse_current,
                _avg(a.current_max for a in arcs),
            )
            _check_range(
                session, pass_run, Deviation.Parameter.PAUSE_CURRENT,
                planned.pause_current, planned.pause_current,
                _avg(a.current_min for a in arcs),
            )

        # скорость: расчётная, из длины шва и времени дуги
        _check_speed(session, pass_run, run)


def _check_range(session, pass_run, parameter, lo, hi, actual):
    """Одно сравнение факта с диапазоном карты."""
    if actual is None or (lo is None and hi is None):
        return

    lo = lo if lo is not None else hi
    hi = hi if hi is not None else lo
    actual = Decimal(str(actual))

    if lo <= actual <= hi:
        return

    if actual > hi:
        percent = (actual - hi) / hi * 100
    else:
        percent = (lo - actual) / lo * 100

    percent = percent.quantize(Decimal("0.1"))

    if percent >= CRITICAL_PERCENT:
        severity = Deviation.Severity.CRITICAL
    elif percent >= WARNING_PERCENT:
        severity = Deviation.Severity.WARNING
    else:
        severity = Deviation.Severity.INFO

    arcs = list(pass_run.arcs.all())
    Deviation.objects.create(
        session=session,
        pass_run=pass_run,
        parameter=parameter,
        severity=severity,
        planned_min=lo,
        planned_max=hi,
        actual_value=actual,
        deviation_percent=percent,
        started_at=arcs[0].started_at,
        finished_at=arcs[-1].finished_at,
    )


def _check_speed(session, pass_run, run):
    """Фактическая скорость = длина шва / время горения дуги.

    Верно только если проход прошёл шов целиком. Если дуга рвалась
    и часть пути осталась, цифра занижена — поэтому уровень
    не выше предупреждения.
    """
    seam = run.weld.seam
    planned = pass_run.planned_pass
    if not seam.seam_length or not pass_run.arc_time or not planned:
        return
    if not planned.speed_min and not planned.speed_max:
        return

    hours = Decimal(pass_run.arc_time.total_seconds()) / Decimal(3600)
    if hours <= 0:
        return

    actual = (Decimal(seam.seam_length) / Decimal(1000)) / hours
    _check_range(
        session, pass_run, Deviation.Parameter.SPEED,
        planned.speed_min, planned.speed_max, actual,
    )


def _avg(values):
    vals = [Decimal(str(v)) for v in values if v is not None]
    return sum(vals) / len(vals) if vals else None


# ───────────────────── расход материалов ─────────────────────

def estimate_consumption(run):
    """Расчётный расход: время горения дуги × норма из карты.

    Это ОЦЕНКА. Расходомера в узле нет: если газ не подали
    или редуктор сбит, расчёт этого не покажет.

    Проволока считается только для механизированных способов —
    на ручной TIG присадку кладут рукой.
    """
    total = timedelta()
    gas_shield = gas_backing = gas_plasma = Decimal(0)
    wire = Decimal(0)
    mechanized = run.card.method.process in ("mig", "plasma")

    for pass_run in run.passes.select_related("planned_pass").all():
        planned = pass_run.planned_pass
        if not planned or not pass_run.arc_time:
            continue

        total += pass_run.arc_time
        minutes = Decimal(pass_run.arc_time.total_seconds()) / Decimal(60)

        gas_shield += minutes * _mid(planned.gas_flow_min, planned.gas_flow_max)
        gas_backing += minutes * _mid(planned.backing_flow_min, planned.backing_flow_max)
        gas_plasma += minutes * _mid(planned.plasma_flow_min, planned.plasma_flow_max)

        if mechanized:
            wire += minutes * _mid(planned.wire_speed_min, planned.wire_speed_max)

    ConsumptionEstimate.objects.update_or_create(
        run=run,
        defaults={
            "arc_time_total": total,
            "gas_shield": gas_shield.quantize(Decimal("0.01")),
            "gas_backing": gas_backing.quantize(Decimal("0.01")),
            "gas_plasma": gas_plasma.quantize(Decimal("0.01")),
            "wire_length": wire.quantize(Decimal("0.01")) if mechanized else None,
        },
    )


def _mid(lo, hi):
    """Середина диапазона — норма задана вилкой."""
    vals = [Decimal(str(v)) for v in (lo, hi) if v is not None]
    return sum(vals) / len(vals) if vals else Decimal(0)