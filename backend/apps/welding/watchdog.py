# Сторож связи: замечает, что узел замолчал, и что снова заговорил.
#
# Вызывается из приёмника телеметрии — у него уже есть цикл,
# который раз в секунду сбрасывает накопитель. 

import logging

from django.db.models import Q
from django.utils import timezone

from .models import NodeOutage, NodeState

log = logging.getLogger(__name__)

# Через сколько секунд молчания считаем, что связи нет.
# С запасом относительно периода status: один пропущенный пакет —
# не повод объявлять обрыв, сеть иногда моргает
OFFLINE_AFTER_SECONDS = 30


def touch(node_id: str, **fields) -> NodeState:
    """Узел прислал сообщение — отметить, что он на связи.

    Вызывается на КАЖДОЕ сообщение из MQTT. Если узел до этого
    считался потерянным, здесь же закрывается запись об обрыве.
    """
    now = timezone.now()

    # get_or_create: узел может появиться в сети раньше, чем его
    # внесут в справочник оборудования. Строку создаём всё равно
    state, created = NodeState.objects.get_or_create(
        node_id=node_id,
        defaults={"last_seen_at": now, "is_online": True},
    )

    was_offline = not state.is_online

    state.last_seen_at = now
    state.is_online = True
    for key, value in fields.items():
        if value is not None:
            setattr(state, key, value)

    # update_fields: пишем только изменённые поля. Это сообщение
    # приходит много раз в секунду, и переписывать всю строку каждый
    # раз — лишняя нагрузка на базу
    changed = ["last_seen_at", "is_online", *fields.keys()]
    state.save(update_fields=changed)

    if was_offline and not created:
        _close_outage(state, now, fields.get("reset_reason", ""))

    return state


def check_offline(timeout: int = OFFLINE_AFTER_SECONDS) -> int:
    """Найти узлы, которые замолчали, и открыть им запись об обрыве.

    Возвращает число узлов, у которых связь только что пропала.
    Вызывать раз в несколько секунд из цикла приёмника.
    """
    now = timezone.now()
    deadline = now - timezone.timedelta(seconds=timeout)

    lost = NodeState.objects.filter(is_online=True).filter(
        Q(last_seen_at__lt=deadline) | Q(last_seen_at__isnull=True)
    )

    count = 0
    for state in lost:
        state.is_online = False
        state.save(update_fields=["is_online"])

        # Начало обрыва — последнее сообщение, а не текущий момент:
        # связи не было уже с того времени
        started = state.last_seen_at or now

        # get_or_create по открытому обрыву: защита от дублей, если
        # проверка почему-то выполнилась дважды
        NodeOutage.objects.get_or_create(
            node=state,
            finished_at__isnull=True,
            defaults={"started_at": started, "kind": "нет связи"},
        )
        log.warning("узел %s потерян, молчит с %s", state.node_id, started)
        count += 1

    return count


def _close_outage(state: NodeState, now, reset_reason: str = "") -> None:
    """Узел вернулся — закрыть открытую запись об обрыве."""
    outage = state.outages.filter(finished_at__isnull=True).first()
    if outage is None:
        return

    outage.finished_at = now

    # Узел, вернувшись, сообщает причину пуска. По ней уточняем,
    # что это было: пропала сеть или пропало питание
    if reset_reason:
        if reset_reason in ("poweron", "power", "brownout"):
            outage.kind = "без питания"
        elif reset_reason in ("sw", "panic", "watchdog", "task_wdt", "int_wdt"):
            outage.kind = "перезапуск"

    outage.save(update_fields=["finished_at", "kind"])
    log.info(
        "узел %s вернулся, обрыв длился %s с (%s)",
        state.node_id,
        outage.duration_seconds,
        outage.kind,
    )


def no_data_seconds(node_id: str, period_from, period_to) -> int:
    """Сколько секунд за период не было данных от узла.

    Нужно для Кз: это время вычитается из фонда отдельной категорией,
    а не записывается в простой. Обрывы, которые выходят за границы
    периода, обрезаются по ним.
    """
    total = 0

    outages = NodeOutage.objects.filter(node__node_id=node_id).filter(
        Q(finished_at__gte=period_from) | Q(finished_at__isnull=True),
        started_at__lte=period_to,
    )

    for outage in outages:
        start = max(outage.started_at, period_from)
        # открытый обрыв считаем до конца периода
        end = min(outage.finished_at or period_to, period_to)
        if end > start:
            total += int((end - start).total_seconds())

    return total