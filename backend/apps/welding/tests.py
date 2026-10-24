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


# ───────────── допуски в ответе сеанса и участка дуги ─────────────

from datetime import timedelta  # noqa: E402

from django.utils import timezone  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from apps.equipment.models import Equipment  # noqa: E402
from apps.methods.models import WeldingMethod  # noqa: E402
from apps.technology.models import Operation, Part, SeamSpec  # noqa: E402
from apps.weldingcards.models import WeldingCard, WeldPass  # noqa: E402

from .models import ArcRun, OperationRun, PartInstance, Weld, WeldingSession, WeldPassRun  # noqa: E402


class PassPlanTests(TransactionTestCase):
    """passPlan у сеанса, проход и длительность у участка дуги."""

    def setUp(self):
        user = get_user_model().objects.create_user(username="plan-test", password="x")
        self.api = APIClient()
        self.api.force_authenticate(user)

        method = WeldingMethod.objects.create(
            id="tig-test", name="РИН", process=WeldingMethod.Process.choices[0][0],
        )
        self.equipment = Equipment.objects.create(name="Тестовый аппарат", method=method)

        part = Part.objects.create(number="T-1", name="Тестовая деталь")
        seam = SeamSpec.objects.create(part=part, number="1")
        operation = Operation.objects.create(part=part, seam=seam, number="010")
        self.card = WeldingCard.objects.create(
            operation=operation, card_no="T-1-010", method=method, is_released=True,
        )
        self.root = WeldPass.objects.create(
            card=self.card, no=1, current_min=90, current_max=110, voltage_min=10, voltage_max=12,
        )
        WeldPass.objects.create(card=self.card, no=2, current_min=140, current_max=160)

        weld = Weld.objects.create(
            instance=PartInstance.objects.create(part=part, serial_no="0001"), seam=seam,
        )
        self.run = OperationRun.objects.create(weld=weld, operation=operation, card=self.card)

    def session(self, run=None):
        now = timezone.now()
        return WeldingSession.objects.create(
            equipment=self.equipment,
            mode="по техпроцессу" if run else "отработка",
            external_id=f"t-{now.timestamp()}",
            started_at=now - timedelta(minutes=10),
            operation_run=run,
        )

    def test_without_card_pass_plan_is_empty(self):
        s = self.session()
        data = self.api.get(f"/api/welding-sessions/{s.id}/").json()
        self.assertEqual(data["passPlan"], [])
        self.assertIsNone(data["cardId"])
        self.assertEqual(data["partNumber"], "")

    def test_with_card_pass_plan_has_tolerances(self):
        s = self.session(self.run)
        data = self.api.get(f"/api/welding-sessions/{s.id}/").json()
        self.assertEqual([p["no"] for p in data["passPlan"]], [1, 2])
        root = data["passPlan"][0]
        self.assertEqual((root["currentMin"], root["currentMax"]), ("90.0", "110.0"))
        self.assertEqual((root["voltageMin"], root["voltageMax"]), ("10.0", "12.0"))
        self.assertEqual(data["cardNo"], "T-1-010")
        self.assertEqual(data["serialNo"], "0001")
        self.assertEqual(data["seamNumber"], "1")

    def test_arc_has_pass_and_numeric_duration(self):
        s = self.session(self.run)
        pass_run = WeldPassRun.objects.create(
            run=self.run, no=1, planned_pass=self.root, match_source=WeldPassRun.MatchSource.SENSOR,
        )
        start = timezone.now() - timedelta(minutes=5)
        ArcRun.objects.create(
            session=s, pass_run=pass_run,
            started_at=start, finished_at=start + timedelta(seconds=245, milliseconds=300),
        )
        ArcRun.objects.create(session=s, started_at=start + timedelta(minutes=4))

        arcs = self.api.get(f"/api/welding-sessions/{s.id}/arcs/").json()
        first, second = arcs
        self.assertEqual(first["durationSeconds"], 245.3)
        self.assertEqual(first["passNo"], 1)
        self.assertEqual(first["plannedPassId"], self.root.id)
        self.assertEqual(first["matchSource"], "датчик")
        # дуга ещё горит и прохода нет — пустые значения, а не ошибка
        self.assertIsNone(second["durationSeconds"])
        self.assertIsNone(second["passNo"])
        self.assertEqual(second["matchSource"], "")

    def test_current_planned_pass_is_pass_of_burning_arc(self):
        s = self.session(self.run)
        pass_run = WeldPassRun.objects.create(run=self.run, no=1, planned_pass=self.root)
        start = timezone.now() - timedelta(minutes=5)
        ArcRun.objects.create(session=s, pass_run=pass_run, started_at=start, finished_at=start + timedelta(minutes=1))
        url = f"/api/welding-sessions/{s.id}/"
        # закрытый участок — сейчас ничего не горит
        self.assertIsNone(self.api.get(url).json()["currentPlannedPassId"])
        # горит участок без прохода — проход ещё не определён
        ArcRun.objects.create(session=s, started_at=start + timedelta(minutes=2))
        self.assertIsNone(self.api.get(url).json()["currentPlannedPassId"])
        # горит участок с проходом
        ArcRun.objects.create(session=s, pass_run=pass_run, started_at=start + timedelta(minutes=3))
        self.assertEqual(self.api.get(url).json()["currentPlannedPassId"], self.root.id)
