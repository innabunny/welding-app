# Отправка данных в открытые браузеры.
#
# Этим пользуется приёмник телеметрии: он получил сообщение из MQTT
# и хочет показать его на панели. Напрямую он до браузеров не достучится —
# это другой процесс. Поэтому кладёт сообщение в шину, а Channels
# разносит его всем подписанным.

import logging
import re

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

log = logging.getLogger(__name__)

# Правило Channels для имён групп: латиница, цифры, «-», «_», «.», короче 100.
# Имя узла проверяет модель Equipment, но узел может прислать что угодно
# в теле сообщения, а живые значения идут пять раз в секунду. С плохим
# именем Channels бросает исключение — роняем не отправку, а только эту группу
_GROUP_RE = re.compile(r"^[A-Za-z0-9._-]+$")
_GROUP_MAX = 100
_reported: set[str] = set()


def _node_group(node: str) -> str | None:
    """Группа панели аппарата или None, если имя узла для Channels не годится."""
    group = f"telemetry.{node}"
    if len(group) < _GROUP_MAX and _GROUP_RE.match(group):
        return group
    if node not in _reported:
        # один раз на узел: иначе лог зальёт строкой пять раз в секунду
        _reported.add(node)
        log.error(
            "имя узла %r не годится для канала живых значений — панель аппарата "
            "их не получит. Имя узла: латиница, цифры, дефис и точка, например node-01",
            node,
        )
    return None


# сломанная рассылка — один раз в лог, а не на каждый такт опроса
_send_failing = False


def _send(layer, group: str, message: dict) -> None:
    """group_send, который не роняет вызывающего.

    Рассылка в браузеры — побочное дело приёмника: если Redis не ответил
    или канал переполнен, такт опроса должен дописать точки в ClickHouse
    и сеанс в базу, а не упасть на полпути. Пишем в лог один раз,
    и ещё раз — когда рассылка снова пошла.
    """
    global _send_failing
    try:
        async_to_sync(layer.group_send)(group, message)
    except Exception as exc:  # noqa: BLE001 — любая ошибка шины здесь не фатальна
        if not _send_failing:
            _send_failing = True
            log.error("рассылка в браузеры не прошла (%s): %s — пропускаю, пока не наладится", group, exc)
        return
    if _send_failing:
        _send_failing = False
        log.info("рассылка в браузеры снова идёт")


def send_live(node: str, payload: dict) -> None:
    """Текущие показания аппарата — на его панель и на общую.

    async_to_sync нужен потому, что Channels внутри асинхронный,
    а приёмник — обычный синхронный скрипт. Эта обёртка позволяет
    вызывать асинхронный код из обычного.
    """
    layer = get_channel_layer()
    if layer is None:
        return

    message = {"type": "telemetry.live", "data": {**payload, "node": node}}

    # в панель конкретного аппарата
    group = _node_group(node)
    if group:
        _send(layer, group, message)
    # и в общую панель цеха
    _send(layer, "telemetry.overview", message)


def send_event(node: str, payload: dict) -> None:
    """Событие: сеанс начат, дуга погасла, найдено отклонение."""
    layer = get_channel_layer()
    if layer is None:
        return

    message = {"type": "telemetry.event", "data": {**payload, "node": node}}
    group = _node_group(node)
    if group:
        _send(layer, group, message)
    _send(layer, "telemetry.overview", message)