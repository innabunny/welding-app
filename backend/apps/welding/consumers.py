# Consumer — то же, что вьюсет, только для WebSocket. Разница в том,
# что соединение не закрывается после ответа: браузер подключился
# и висит, а сервер шлёт ему данные, когда они появляются.
#
# Как данные сюда попадают. Приёмник телеметрии — ОТДЕЛЬНЫЙ процесс,
# он ничего не знает про открытые браузеры. Он кладёт сообщение
# в общую шину (Redis), а Channels раздаёт его всем, кто подписан
# на нужную группу. Группа здесь — один аппарат.

import asyncio
import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings

log = logging.getLogger(__name__)

# подтверждаем членство вдвое чаще срока хранения: один пропуск не страшен
REFRESH_SECONDS = settings.CHANNEL_GROUP_EXPIRY / 2
# на удаление из группы при закрытии — не дольше, Redis может не отвечать
DISCARD_TIMEOUT = 2


class LiveGroups(AsyncWebsocketConsumer):
    """Членство в группах, которое не копит мёртвые каналы.

    Группа хранит канал CHANNEL_GROUP_EXPIRY секунд (см. settings).
    Живое соединение каждые полминуты подтверждает членство, мёртвое
    перестаёт — и через минуту выпадает само.

    Удаление из группы — в finally вокруг всей работы консьюмера, а не
    только в disconnect(): если консьюмер упал с исключением (например,
    таймаут Redis), disconnect() не вызывается, а finally — всегда.
    """

    _groups: tuple[str, ...] = ()
    _refresher: asyncio.Task | None = None

    async def join(self, *groups: str) -> None:
        self._groups = groups
        for group in groups:
            await self.channel_layer.group_add(group, self.channel_name)
        self._refresher = asyncio.create_task(self._refresh())

    async def _refresh(self) -> None:
        while True:
            await asyncio.sleep(REFRESH_SECONDS)
            for group in self._groups:
                try:
                    await self.channel_layer.group_add(group, self.channel_name)
                except Exception as exc:  # noqa: BLE001 — следующая попытка через полминуты
                    log.warning("не подтвердил членство в %s: %s", group, exc)

    async def leave(self) -> None:
        if self._refresher is not None:
            self._refresher.cancel()
            self._refresher = None
        groups, self._groups = self._groups, ()
        for group in groups:
            try:
                await asyncio.wait_for(
                    self.channel_layer.group_discard(group, self.channel_name), DISCARD_TIMEOUT
                )
            except Exception as exc:  # noqa: BLE001 — не удалили, сам выпадет через минуту
                log.info("не удалил канал из %s: %s", group, exc)

    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        finally:
            await self.leave()

    async def disconnect(self, code):
        await self.leave()


async def _reject_unauthorized(consumer):
    """Закрыть соединение с кодом 4001 «пользователь не вошёл».

    Сначала принять, потом закрыть. Если закрыть до accept(),
    Channels отвечает на рукопожатие отказом HTTP 403, и браузер
    видит только код 1006 — его не отличить от обрыва сети,
    и панель бесконечно переподключалась бы вместо «войдите заново».
    """
    await consumer.accept()
    await consumer.close(code=4001)


class TelemetryConsumer(LiveGroups):
    """Живые показания одного аппарата.

    Браузер подключается к /ws/telemetry/node-01/ и получает ток,
    напряжение и состояние дуги примерно раз в секунду.
    """

    async def reject_unauthorized(self):
        await _reject_unauthorized(self)

    async def connect(self):
        self.node = self.scope["url_route"]["kwargs"]["node"]
        self.group = f"telemetry.{self.node}"

        # пускаем только тех, кто вошёл в портал: авторизация та же,
        # что у остального API, отдельной не заводим
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.reject_unauthorized()
            return

        await self.join(self.group)
        await self.accept()

    async def receive(self, text_data=None, bytes_data=None):
        """Браузер ничего не присылает — панель только слушает."""
        return

    # --- обработчики сообщений из шины ---
    # Имя метода берётся из поля "type" сообщения: тип telemetry.live
    # вызывает метод telemetry_live. Точка превращается в подчёркивание.

    async def telemetry_live(self, event):
        """Текущие ток и напряжение."""
        await self.send(text_data=json.dumps(event["data"]))

    async def telemetry_event(self, event):
        """Событие: дуга зажглась, сеанс закрыт, отклонение найдено."""
        await self.send(text_data=json.dumps(event["data"]))


class OverviewConsumer(LiveGroups):
    """Общая панель: все аппараты сразу.

    Для экрана «что сейчас происходит в цехе» — какой аппарат варит,
    кто за ним, в допуске ли режим.
    """

    GROUP = "telemetry.overview"

    async def reject_unauthorized(self):
        await _reject_unauthorized(self)

    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.reject_unauthorized()
            return

        await self.join(self.GROUP)
        await self.accept()

    async def telemetry_live(self, event):
        await self.send(text_data=json.dumps(event["data"]))

    async def telemetry_event(self, event):
        await self.send(text_data=json.dumps(event["data"]))