# Проверка WebSocket телеметрии: вход по токену и доставка показаний.
#
# Тест поднимает приложение целиком (как Daphne), но без сети:
# WebsocketCommunicator изображает браузер. Пользователь и токен
# создаются во временной тестовой базе и удаляются после теста.
# Шина — в памяти процесса, Redis для теста не нужен.

from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, override_settings
from rest_framework.authtoken.models import Token

from config.asgi import application

from .broadcast import send_live

IN_MEMORY = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


@override_settings(CHANNEL_LAYERS=IN_MEMORY)
class TelemetrySocketTests(TransactionTestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(username="ws-test", password="x")
        self.token = Token.objects.create(user=user).key

    async def test_no_token_closes_with_4001(self):
        ws = WebsocketCommunicator(application, "/ws/telemetry/")
        connected, _ = await ws.connect()
        # принимаем и сразу закрываем: браузер должен увидеть именно 4001
        self.assertTrue(connected)
        out = await ws.receive_output(timeout=2)
        self.assertEqual(out, {"type": "websocket.close", "code": 4001})

    async def test_wrong_token_closes_with_4001(self):
        ws = WebsocketCommunicator(application, "/ws/telemetry/node-01/?token=wrong")
        await ws.connect()
        out = await ws.receive_output(timeout=2)
        self.assertEqual(out, {"type": "websocket.close", "code": 4001})

    async def test_token_receives_live_tick(self):
        ws = WebsocketCommunicator(application, f"/ws/telemetry/node-01/?token={self.token}")
        connected, _ = await ws.connect()
        self.assertTrue(connected)

        # так показания отправляет приёмник телеметрии
        await sync_to_async(send_live)(
            "node-01", {"i": 142.5, "u": 12.3, "arc": True, "sid": "test-1", "ts": 1760000000000}
        )
        msg = await ws.receive_json_from(timeout=2)
        self.assertEqual(
            msg,
            {"i": 142.5, "u": 12.3, "arc": True, "sid": "test-1", "ts": 1760000000000, "node": "node-01"},
        )
        await ws.disconnect()
