# Consumer — то же, что вьюсет, только для WebSocket. Разница в том,
# что соединение не закрывается после ответа: браузер подключился
# и висит, а сервер шлёт ему данные, когда они появляются.
#
# Как данные сюда попадают. Приёмник телеметрии — ОТДЕЛЬНЫЙ процесс,
# он ничего не знает про открытые браузеры. Он кладёт сообщение
# в общую шину (Redis), а Channels раздаёт его всем, кто подписан
# на нужную группу. Группа здесь — один аппарат.

import json

from channels.generic.websocket import AsyncWebsocketConsumer


async def _reject_unauthorized(consumer):
    """Закрыть соединение с кодом 4001 «пользователь не вошёл».

    Сначала принять, потом закрыть. Если закрыть до accept(),
    Channels отвечает на рукопожатие отказом HTTP 403, и браузер
    видит только код 1006 — его не отличить от обрыва сети,
    и панель бесконечно переподключалась бы вместо «войдите заново».
    """
    await consumer.accept()
    await consumer.close(code=4001)


class TelemetryConsumer(AsyncWebsocketConsumer):
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

        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        # getattr: если отключились до входа в группу, атрибута ещё нет
        group = getattr(self, "group", None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

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


class OverviewConsumer(AsyncWebsocketConsumer):
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

        await self.channel_layer.group_add(self.GROUP, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.GROUP, self.channel_name)

    async def telemetry_live(self, event):
        await self.send(text_data=json.dumps(event["data"]))

    async def telemetry_event(self, event):
        await self.send(text_data=json.dumps(event["data"]))