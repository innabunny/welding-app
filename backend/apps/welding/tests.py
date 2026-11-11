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


# ───────────── решения по отклонениям: кто и какое может поставить ─────────────

from .models import Deviation, WeldDecision  # noqa: E402


class DecisionRulesTests(TransactionTestCase):
    def setUp(self):
        method = WeldingMethod.objects.create(id="tig-d", name="РИН", process=WeldingMethod.Process.choices[0][0])
        equipment = Equipment.objects.create(name="Аппарат", method=method)
        now = timezone.now()
        self.session = WeldingSession.objects.create(
            equipment=equipment, mode="отработка", external_id="d-1", started_at=now,
        )
        self.regime = Deviation.objects.create(
            session=self.session, parameter="ток", started_at=now, planned_min=90, planned_max=110, actual_value=82,
        )
        self.order = Deviation.objects.create(session=self.session, parameter="без_карты", started_at=now)

    def client_as(self, role):
        user = get_user_model().objects.create_user(username=f"u-{role}", password="x", role=role)
        api = APIClient()
        api.force_authenticate(user)
        return api

    def post(self, api, result, deviations, **extra):
        body = {"session": self.session.id, "result": result, "deviations": [d.id for d in deviations], **extra}
        return api.post("/api/weld-decisions/", body, format="json")

    def test_technologist_decides_regime_and_deviation_becomes_reviewed(self):
        r = self.post(self.client_as("technologist"), "допущено", [self.regime], reason="кратковременно")
        self.assertEqual(r.status_code, 201, r.content)
        self.regime.refresh_from_db()
        self.assertTrue(self.regime.reviewed)

    def test_master_handles_order_violation(self):
        r = self.post(self.client_as("master"), "разобрано", [self.order])
        self.assertEqual(r.status_code, 201, r.content)

    def test_master_cannot_decide_regime(self):
        r = self.post(self.client_as("master"), "допущено", [self.regime])
        self.assertEqual(r.status_code, 400)
        self.assertIn("result", r.json())

    def test_result_must_match_kind(self):
        api = self.client_as("technologist")
        self.assertEqual(self.post(api, "разобрано", [self.regime]).status_code, 400)
        self.assertEqual(self.post(api, "на переварку", [self.order]).status_code, 400)
        self.assertEqual(self.post(api, "допущено", [self.regime, self.order]).status_code, 400)

    def test_control_requires_kind_of_control(self):
        api = self.client_as("technologist")
        r = self.post(api, "на контроль", [self.regime])
        self.assertEqual(r.status_code, 400)
        self.assertIn("assignedControl", r.json())
        self.assertEqual(self.post(api, "на контроль", [self.regime], assignedControl="РК").status_code, 201)

    def test_inspector_cannot_sign(self):
        self.assertEqual(self.post(self.client_as("inspector"), "разобрано", [self.order]).status_code, 403)

    def test_master_cannot_edit_signed_decision(self):
        r = self.post(self.client_as("technologist"), "допущено", [self.regime])
        decision_id = r.json()["id"]
        patch = self.client_as("master").patch(f"/api/weld-decisions/{decision_id}/", {"reason": "x"}, format="json")
        self.assertEqual(patch.status_code, 403)
        self.assertEqual(WeldDecision.objects.get(id=decision_id).reason, "")


@override_settings(ALLOWED_HOSTS=["testserver"])
class TelemetrySummaryTests(TransactionTestCase):
    """Сводка «Сварочное производство»: форма ответа и проверка параметров."""

    def setUp(self):
        from rest_framework.test import APIClient

        self.client = APIClient()
        self.client.force_authenticate(get_user_model().objects.create_user(username="summary", password="x"))

    def test_needs_period(self):
        r = self.client.get("/api/telemetry-summary/?from=2026-10-01")
        self.assertEqual(r.status_code, 400)

    def test_end_before_start(self):
        r = self.client.get("/api/telemetry-summary/?from=2026-10-10&to=2026-10-01")
        self.assertEqual(r.status_code, 400)

    def test_empty_fleet_has_all_blocks(self):
        r = self.client.get("/api/telemetry-summary/?from=2026-10-01&to=2026-10-07")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        for block in ("load", "deviations", "materials", "works", "types"):
            self.assertIn(block, data)
        # без оборудования фонда нет — Кз не считается от нуля
        self.assertEqual(data["load"]["fundSeconds"], 0)
        self.assertEqual(data["load"]["kz"], 0)
        self.assertEqual([t["type"] for t in data["types"]], ["arc", "contact", "ebw", "diff"])
        self.assertEqual(set(data["works"]["arc"]["quality"]), {
            "без отклонений", "допущено", "на контроль", "не рассмотрено", "на переварку",
        })


@override_settings(CHANNEL_LAYERS=IN_MEMORY)
class BroadcastNodeNameTests(TransactionTestCase):
    """Плохое имя узла не роняет отправку живых значений и пишется в лог один раз."""

    def test_mac_name_skipped_once(self):
        from . import broadcast

        broadcast._reported.clear()
        with self.assertLogs("apps.welding.broadcast", level="ERROR") as logs:
            for _ in range(5):
                send_live("A0:B7:65:12:34:56", {"i": 1, "u": 1, "arc": True})
        self.assertEqual(len(logs.output), 1)

    def test_good_name_no_log(self):
        from . import broadcast

        broadcast._reported.clear()
        send_live("node-01", {"i": 1, "u": 1, "arc": True})
        self.assertEqual(broadcast._reported, set())


@override_settings(CHANNEL_LAYERS=IN_MEMORY)
class GroupMembershipTests(TransactionTestCase):
    """Канал не остаётся в группе после закрытия — иначе группы копят мёртвые каналы."""

    def setUp(self):
        user = get_user_model().objects.create_user(username="ws-groups", password="x")
        self.token = Token.objects.create(user=user).key

    async def test_overview_channel_leaves_group(self):
        from channels.layers import get_channel_layer

        layer = get_channel_layer()
        ws = WebsocketCommunicator(application, f"/ws/telemetry/?token={self.token}")
        connected, _ = await ws.connect()
        self.assertTrue(connected)
        self.assertEqual(len(layer.groups.get("telemetry.overview", {})), 1)
        await ws.disconnect()
        self.assertEqual(len(layer.groups.get("telemetry.overview", {})), 0)


class BroadcastFailureTests(TransactionTestCase):
    """Сбой шины не роняет такт опроса: ошибка в лог один раз, отправка продолжается."""

    def test_failing_layer_logged_once(self):
        from unittest import mock

        from . import broadcast

        class Broken:
            async def group_send(self, group, message):
                raise TimeoutError("Timeout reading from redis")

        broadcast._send_failing = False
        with mock.patch.object(broadcast, "get_channel_layer", return_value=Broken()):
            with self.assertLogs("apps.welding.broadcast", level="ERROR") as logs:
                for _ in range(5):
                    send_live("node-01", {"i": 1, "u": 1, "arc": True})
        self.assertEqual(len(logs.output), 1)
        broadcast._send_failing = False


class NodeLinkTests(TransactionTestCase):
    """touch() сам привязывает узел к оборудованию по node_id."""

    def setUp(self):
        self.method = WeldingMethod.objects.create(id="tig-l", name="РИН", process="tig")

    def test_links_existing_equipment(self):
        from .watchdog import touch

        eq = Equipment.objects.create(name="Пост 1", method=self.method, node_id="node-l1")
        self.assertEqual(touch("node-l1").equipment_id, eq.id)

    def test_unknown_node_stays_unlinked_then_links_later(self):
        from .watchdog import touch

        self.assertIsNone(touch("node-l2").equipment_id)
        eq = Equipment.objects.create(name="Пост 2", method=self.method, node_id="node-l2")
        self.assertEqual(touch("node-l2").equipment_id, eq.id)

    def test_linked_node_does_not_look_up_again(self):
        from .watchdog import touch

        Equipment.objects.create(name="Пост 3", method=self.method, node_id="node-l3")
        touch("node-l3")
        # привязан: только чтение состояния и запись, без поиска оборудования
        with self.assertNumQueries(2):
            touch("node-l3")


@override_settings(CHANNEL_LAYERS=IN_MEMORY)
class NodeStatusEventTests(TransactionTestCase):
    """Пропажа и возврат узла сразу уходят в браузеры событием."""

    def setUp(self):
        user = get_user_model().objects.create_user(username="ws-node", password="x")
        self.token = Token.objects.create(user=user).key

    async def test_offline_and_online_events(self):
        from .watchdog import mark_offline, touch

        state = await sync_to_async(touch)("node-ev")
        ws = WebsocketCommunicator(application, f"/ws/telemetry/?token={self.token}")
        connected, _ = await ws.connect()
        self.assertTrue(connected)

        await sync_to_async(mark_offline)(state, state.last_seen_at)
        self.assertEqual(await ws.receive_json_from(timeout=2), {"event": "node_offline", "node": "node-ev"})

        await sync_to_async(touch)("node-ev")
        self.assertEqual(await ws.receive_json_from(timeout=2), {"event": "node_online", "node": "node-ev"})
        await ws.disconnect()


# ───────────── журнал прикладываний карт ─────────────

from django.contrib.admin.sites import site as admin_site  # noqa: E402
from django.test import RequestFactory, TestCase  # noqa: E402

from apps.welders.models import Welder  # noqa: E402

from .models import CardTap  # noqa: E402


class CardTapApiTests(TestCase):
    """Журнал только читается: фильтры, страницы, никаких правок."""

    def setUp(self):
        method = WeldingMethod.objects.create(id="tig-j", name="РИН", process=WeldingMethod.Process.choices[0][0])
        self.eq1 = Equipment.objects.create(name="Аппарат 1", method=method, node_id="node-j1")
        self.eq2 = Equipment.objects.create(name="Аппарат 2", method=method, node_id="node-j2")
        self.w = Welder.objects.create(fio="Иванов И. И.", education="—", rfid_uid="00aa00aa")
        t = timezone.make_aware(timezone.datetime(2026, 11, 2, 9, 0))

        def tap(eq, accepted, days, welder=None, seq=1):
            CardTap.objects.create(
                node_id=eq.node_id, equipment=eq, equipment_name=eq.name,
                card_uid="00aa00aa", welder=welder, welder_name=welder.fio if welder else "",
                accepted=accepted, reason="" if accepted else "нет действующей аттестации",
                tapped_at=t + timedelta(days=days), node_seq=seq,
            )

        tap(self.eq1, True, 0, self.w, 1)
        tap(self.eq1, False, 1, self.w, 2)
        tap(self.eq2, False, 5, None, 1)
        self.user = get_user_model().objects.create_user(username="taps", password="x")
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def get(self, **params):
        r = self.api.get("/api/card-taps/", params)
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()

    def test_filters(self):
        self.assertEqual(self.get()["count"], 3)
        self.assertEqual(self.get(equipment=self.eq1.id)["count"], 2)
        self.assertEqual(self.get(welder=self.w.id)["count"], 2)
        self.assertEqual(self.get(result="refused")["count"], 2)
        self.assertEqual(self.get(result="accepted")["count"], 1)
        self.assertEqual(self.get(**{"from": "2026-11-03", "to": "2026-11-03"})["count"], 1)
        # новые сверху, поля в camelCase
        first = self.get()["results"][0]
        self.assertEqual(first["equipmentName"], "Аппарат 2")
        self.assertFalse(first["accepted"])

    def test_bad_date_is_400_not_500(self):
        self.assertEqual(self.api.get("/api/card-taps/", {"from": "вчера"}).status_code, 400)

    def test_read_only_api_and_admin(self):
        tap = CardTap.objects.first()
        self.assertEqual(self.api.post("/api/card-taps/", {}).status_code, 405)
        self.assertEqual(self.api.delete(f"/api/card-taps/{tap.id}/").status_code, 405)
        # даже суперпользователь в админке не может добавить, поправить, удалить
        admin = admin_site._registry[CardTap]
        request = RequestFactory().get("/")
        request.user = get_user_model().objects.create_superuser(username="root", password="x")
        self.assertFalse(admin.has_add_permission(request))
        self.assertFalse(admin.has_change_permission(request, tap))
        self.assertFalse(admin.has_delete_permission(request, tap))
