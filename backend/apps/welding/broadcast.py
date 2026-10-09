# Отправка данных в открытые браузеры.
#
# Этим пользуется приёмник телеметрии: он получил сообщение из MQTT
# и хочет показать его на панели. Напрямую он до браузеров не достучится —
# это другой процесс. Поэтому кладёт сообщение в шину, а Channels
# разносит его всем подписанным.

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


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
    async_to_sync(layer.group_send)(f"telemetry.{node}", message)
    # и в общую панель цеха
    async_to_sync(layer.group_send)("telemetry.overview", message)


def send_event(node: str, payload: dict) -> None:
    """Событие: сеанс начат, дуга погасла, найдено отклонение."""
    layer = get_channel_layer()
    if layer is None:
        return

    message = {"type": "telemetry.event", "data": {**payload, "node": node}}
    async_to_sync(layer.group_send)(f"telemetry.{node}", message)
    async_to_sync(layer.group_send)("telemetry.overview", message)