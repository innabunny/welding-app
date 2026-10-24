# Закрытие «забытых» сеансов демонстрационного наполнения.
#
# seed_demo делает снимок производства «на сейчас», и часть сеансов
# в этом снимке идёт прямо сейчас. Но снимок стареет, а сеансы так
# и остаются открытыми — неделю спустя кажется, что в цеху никто
# не выключал аппараты.
#
# Как отличить демонстрационные сеансы от настоящих: у сеанса с узла
# всегда есть external_id (его генерирует узел), у seed_demo — нет.
# Настоящие сеансы эта функция не трогает никогда.

from datetime import timedelta

from django.db.models import Max
from django.utils import timezone

from apps.welding.models import ArcRun, WeldingSession, WeldPassRun

# сколько длится участок дуги, у которого не было конца
ARC_FALLBACK = timedelta(minutes=2)
# сколько длится сеанс, в котором дуги не было вовсе
SESSION_FALLBACK = timedelta(minutes=10)


def close_demo_sessions(now=None) -> int:
    """Закрыть незакрытые сеансы без external_id. Возвращает, сколько закрыто.

    Закрываем, а не удаляем: к сеансам привязаны участки дуги,
    проходы и отклонения, без них опустели бы швы и рабочий стол.
    Выполнение операции остаётся «в работе» — операция не закончена,
    сварщик прервался, это обычное состояние.
    """
    now = now or timezone.now()
    latest = now - timedelta(minutes=1)
    sessions = WeldingSession.objects.filter(finished_at__isnull=True, external_id__isnull=True)
    closed = 0

    for session in sessions:
        # участки без конца: дуга не может гореть до сих пор
        for arc in ArcRun.objects.filter(session=session, finished_at__isnull=True):
            arc.finished_at = min(arc.started_at + ARC_FALLBACK, latest)
            arc.save(update_fields=["finished_at"])

        end = session.arcs.aggregate(m=Max("finished_at"))["m"] or session.started_at + SESSION_FALLBACK
        session.finished_at = min(max(end, session.started_at), latest)
        session.save(update_fields=["finished_at"])

        if session.operation_run_id:
            WeldPassRun.objects.filter(
                run_id=session.operation_run_id, finished_at__isnull=True,
            ).update(finished_at=session.finished_at)
        closed += 1

    return closed
