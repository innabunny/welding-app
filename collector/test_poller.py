# Тесты логики опроса узла: без сети и без ClickHouse.
# Ответы узла подставляются напрямую в on_state, точки ловит
# подставной приёмник. База — тестовая, шина — в памяти.
#
# Запуск в контейнере приёмника:
#   docker compose exec collector sh -c "cd /backend && PYTHONPATH=/app python manage.py test test_poller"

from datetime import datetime, timedelta, timezone

from django.contrib.auth import get_user_model  # noqa: F401  (модели должны быть загружены)
from django.test import TestCase, override_settings

from apps.equipment.models import Equipment
from apps.methods.models import WeldingMethod
from apps.welders.models import Welder
from apps.welding.models import ArcRun, WeldingSession

import poller
from poller import NodePoller

T0 = datetime(2026, 10, 24, 10, 0, tzinfo=timezone.utc)


class FakeSink:
    def __init__(self):
        self.rows = []
        self.analyzed = []

    def add_rows(self, rows):
        self.rows.extend(rows)

    def analyze_later(self, session):
        self.analyzed.append(session.id)


def state(arc=False, allowed=True, uid="0080A182", a=0.0, v=0.0, aa=0.0, amin=0.0, amax=0.0, va=0.0):
    return {
        "a": a, "v": v, "arc": arc, "allowed": allowed, "welder": uid if allowed else "",
        "aa": aa, "amin": amin, "amax": amax, "va": va, "t": 50.0, "free": 800000,
    }


@override_settings(CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class PollerLogicTests(TestCase):
    def setUp(self):
        method = WeldingMethod.objects.create(id="tig-p", name="РИН", process=WeldingMethod.Process.choices[0][0])
        Equipment.objects.create(name="Аппарат", method=method, node_id="node-t", node_ip="127.0.0.1")
        self.welder = Welder.objects.create(fio="Иванов Иван Иванович", education="—", rfid_uid="0080a182")
        self.sink = FakeSink()
        self.p = NodePoller("node-t", "127.0.0.1", self.sink)

    def at(self, seconds):
        return T0 + timedelta(seconds=seconds)

    def test_card_opens_session_with_welder_found_by_lowercase_uid(self):
        self.p.on_state(state(), self.at(0))
        s = WeldingSession.objects.get()
        self.assertEqual(s.welder, self.welder)
        self.assertEqual(s.external_id, f"node-t-{int(T0.timestamp() * 1000)}")
        self.assertIsNone(s.finished_at)

    def test_points_are_instant_values_and_arc_summary_is_from_last_arc_state(self):
        self.p.on_state(state(), self.at(0))
        self.p.on_state(state(arc=True, a=150.2, v=11.6, aa=149.0, amin=140.0, amax=151.0, va=11.5), self.at(1))
        self.p.on_state(state(arc=True, a=148.0, v=11.4, aa=149.9, amin=138.1, amax=153.3, va=11.4), self.at(2))
        self.p.on_state(state(arc=False), self.at(3))

        # в точке — мгновенные a и v, а не накопительные aa/amin/amax
        self.assertEqual([r[4:] for r in self.sink.rows], [(150.2, 150.2, 150.2, 11.6), (148.0, 148.0, 148.0, 11.4)])
        arc = ArcRun.objects.get()
        self.assertEqual(arc.finished_at, self.at(3))
        self.assertEqual((float(arc.current_avg), float(arc.current_min), float(arc.current_max)), (149.9, 138.1, 153.3))
        self.assertEqual(float(arc.voltage_avg), 11.4)
        self.assertTrue(arc.telemetry_complete)

    def test_idle_closes_session_and_lying_card_does_not_reopen_it(self):
        idle = poller.SESSION_IDLE_SECONDS
        self.p.on_state(state(), self.at(0))
        self.p.on_state(state(arc=True, a=150, v=12), self.at(1))
        self.p.on_state(state(), self.at(2))
        self.p.on_state(state(), self.at(3 + idle))
        self.assertIsNotNone(WeldingSession.objects.get().finished_at)

        # карта так и лежит — нового сеанса нет
        self.p.on_state(state(), self.at(4 + idle))
        self.assertEqual(WeldingSession.objects.count(), 1)
        # загорелась дуга — новый сеанс
        self.p.on_state(state(arc=True, a=150, v=12), self.at(5 + idle))
        self.assertEqual(WeldingSession.objects.filter(finished_at__isnull=True).count(), 1)

    def test_card_removed_closes_session_and_runs_analysis(self):
        self.p.on_state(state(), self.at(0))
        self.p.on_state(state(allowed=False), self.at(5))
        s = WeldingSession.objects.get()
        self.assertEqual(s.finished_at, self.at(5))
        self.assertEqual(self.sink.analyzed, [s.id])

    def test_other_card_closes_session_and_opens_new_one(self):
        self.p.on_state(state(), self.at(0))
        self.p.on_state(state(uid="11223344"), self.at(5))
        first, second = WeldingSession.objects.order_by("started_at")
        self.assertEqual(first.finished_at, self.at(5))
        self.assertIsNone(second.finished_at)
        self.assertIsNone(second.welder)

    def test_gap_during_arc_marks_arc_incomplete(self):
        self.p.on_state(state(), self.at(0))
        self.p.on_state(state(arc=True, a=150, v=12, aa=150), self.at(1))
        self.p.on_failure(OSError("нет ответа"))
        self.p.on_state(state(arc=False), self.at(2))
        self.assertFalse(ArcRun.objects.get().telemetry_complete)


@override_settings(CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class PollerOfflineTests(TestCase):
    """Опрос сам объявляет «нет связи» через POLL_OFFLINE_SECONDS и снимает его при ответе."""

    def setUp(self):
        method = WeldingMethod.objects.create(id="tig-o", name="РИН", process=WeldingMethod.Process.choices[0][0])
        Equipment.objects.create(name="Аппарат", method=method, node_id="node-o", node_ip="127.0.0.1")
        self.p = NodePoller("node-o", "127.0.0.1", FakeSink())

    def test_offline_after_threshold_then_back(self):
        from unittest import mock

        from apps.welding.models import NodeOutage, NodeState

        self.p.on_state(state(allowed=False), T0)
        self.assertTrue(NodeState.objects.get(node_id="node-o").is_online)

        with mock.patch.object(poller, "POLL_OFFLINE_SECONDS", 0):
            self.p.on_failure(TimeoutError("нет ответа"))
            self.p.on_failure(TimeoutError("нет ответа"))
        node = NodeState.objects.get(node_id="node-o")
        self.assertFalse(node.is_online)
        self.assertEqual(NodeOutage.objects.filter(node=node, finished_at__isnull=True).count(), 1)

        self.p.on_state(state(allowed=False), T0 + timedelta(seconds=10))
        node.refresh_from_db()
        self.assertTrue(node.is_online)
        self.assertEqual(NodeOutage.objects.filter(node=node, finished_at__isnull=True).count(), 0)

    def test_short_stall_is_not_offline(self):
        from apps.welding.models import NodeState

        self.p.on_state(state(allowed=False), T0)
        self.p.on_failure(TimeoutError("нет ответа"))
        self.assertTrue(NodeState.objects.get(node_id="node-o").is_online)


@override_settings(CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class CardListTests(TestCase):
    """Список разрешённых карт для узла и его отправка."""

    def setUp(self):
        from datetime import date

        from apps.attestation.models import Attestation
        from apps.materials.models import MaterialGroup

        method = WeldingMethod.objects.create(id="tig-c", name="РИН", process=WeldingMethod.Process.choices[0][0])
        other = WeldingMethod.objects.create(id="mig-c", name="МП", process=WeldingMethod.Process.choices[0][0])
        group = MaterialGroup.objects.create(code="M01")
        Equipment.objects.create(name="Аппарат", method=method, node_id="node-c", node_ip="127.0.0.1")
        Equipment.objects.create(name="Полуавтомат", method=other, node_id="node-m", node_ip="127.0.0.2")

        def welder(uid, **kw):
            return Welder.objects.create(fio=uid, education="—", rfid_uid=uid, **kw)

        def attest(w, until, on=method):
            Attestation.objects.create(welder=w, method=on, group=group, status="done",
                                       attested_at=date(2025, 1, 1), valid_until=until)

        attest(welder("00aa0001"), date(2099, 1, 1))                   # действует
        attest(welder("00aa0002"), date(2000, 1, 1))                   # просрочена
        welder("00aa0003")                                             # без аттестации
        welder("007D6A16", is_service=True)                            # сервисная
        attest(welder("00aa0005", is_active=False), date(2099, 1, 1))  # уволен
        attest(welder("00aa0006"), date(2099, 1, 1), on=other)         # допуск на другой способ
        poller.CARDS.cache.clear()  # кэш общий для модуля — сбрасываем между тестами

    def test_list_has_attested_and_service_cards_only(self):
        ver, uids = poller.CARDS.get("node-c")
        self.assertEqual(uids, ["007d6a16", "00aa0001"])
        self.assertEqual(len(ver), 8)
        self.assertEqual(poller.CardList.body(ver, uids), f"v={ver}\n007d6a16\n00aa0001\n")

    def test_list_follows_method_of_node_equipment(self):
        # на полуавтомате — только допущенный на него и сервисная карта
        self.assertEqual(poller.CARDS.get("node-m")[1], ["007d6a16", "00aa0006"])
        # узел без аппарата — способ неизвестен, только сервисные
        self.assertEqual(poller.CARDS.get("node-x")[1], ["007d6a16"])

    def test_version_is_fingerprint_of_list(self):
        ver1, _ = poller.CardList.build("tig-c")
        self.assertEqual(poller.CardList.build("tig-c")[0], ver1)
        Welder.objects.filter(rfid_uid="00aa0003").update(is_service=True)
        self.assertNotEqual(poller.CardList.build("tig-c")[0], ver1)

    def test_sends_only_when_versions_differ_and_not_every_tick(self):
        from unittest import mock

        p = NodePoller("node-c", "127.0.0.1", FakeSink())
        ver, _ = poller.CardList.build("tig-c")
        with mock.patch.object(p.http, "post") as post:
            post.return_value.ok = True
            post.return_value.status_code = 200
            post.return_value.text = "ok"
            p.sync_cards({"cards_ver": "", "cards_n": 0})
            p.sync_cards({"cards_ver": "", "cards_n": 0})   # повтор не раньше CARDS_RETRY_SECONDS
            self.assertEqual(post.call_count, 1)
            self.assertEqual(post.call_args.kwargs["data"].decode().splitlines()[0], f"v={ver}")
            p.sync_cards({"cards_ver": ver, "cards_n": 2})
            p.sync_cards({})                                # старая прошивка — не трогаем
            self.assertEqual(post.call_count, 1)

    def test_tap_logged_once_per_seq_including_refusals(self):
        p = NodePoller("node-c", "127.0.0.1", FakeSink())
        with self.assertLogs("poller", "INFO") as logs:
            p.log_tap({"tap_seq": 3, "tap_uid": "00AA0003", "tap_ok": False, "tap_age": 1})
            p.log_tap({"tap_seq": 3, "tap_uid": "00AA0003", "tap_ok": False, "tap_age": 2})
            p.log_tap({"tap_seq": 4, "tap_uid": "007D6A16", "tap_ok": True, "tap_age": 0})
        self.assertEqual(len(logs.output), 2)
        self.assertIn("00aa0003", logs.output[0])
        self.assertIn("ОТКАЗ", logs.output[0])
        self.assertIn("ПРИНЯТА", logs.output[1])

    def test_tap_not_logged_again_after_collector_restart(self):
        from apps.welding.models import NodeState

        NodeState.objects.create(node_id="node-c")
        tap = {"tap_seq": 7, "tap_uid": "00AA0003", "tap_ok": False, "tap_age": 1}
        with self.assertLogs("poller", "INFO") as logs:
            NodePoller("node-c", "127.0.0.1", FakeSink()).log_tap(tap)
        self.assertEqual(len(logs.output), 1)
        self.assertEqual(NodeState.objects.get(node_id="node-c").last_tap_seq, 7)

        # приёмник перезапустили — новый поток, то же событие в ответе узла
        restarted = NodePoller("node-c", "127.0.0.1", FakeSink())
        with self.assertNoLogs("poller", "INFO"):
            restarted.log_tap(tap)
        with self.assertLogs("poller", "INFO"):
            restarted.log_tap({**tap, "tap_seq": 8})

    # ── журнал прикладываний CardTap ──

    def tap(self, uid, ok, seq, node="node-c", cards_ver=None, age=0):
        p = NodePoller(node, "127.0.0.1", FakeSink())
        ver = poller.CARDS.get(node)[0]
        st = {"tap_seq": seq, "tap_uid": uid.upper(), "tap_ok": ok, "tap_age": age,
              "cards_ver": ver if cards_ver is None else cards_ver}
        p.log_tap(st, T0)
        from apps.welding.models import CardTap
        return CardTap.objects.get(node_id=node, node_seq=seq)

    def test_journal_refusal_reasons_from_database(self):
        from apps.welding import card_access as ca

        self.assertEqual(self.tap("00ffffff", False, 1).reason, ca.NOT_REGISTERED)
        self.assertEqual(self.tap("00aa0005", False, 2).reason, ca.INACTIVE)
        self.assertEqual(self.tap("00aa0002", False, 3).reason, ca.NO_ATTESTATION)   # просрочена
        self.assertEqual(self.tap("00aa0003", False, 4).reason, ca.NO_ATTESTATION)   # не было
        self.assertEqual(self.tap("00aa0006", False, 5).reason, ca.NO_METHOD)        # допуск на МП, аппарат РИН
        self.assertEqual(self.tap("00aa0001", False, 6, node="node-x").reason, ca.UNKNOWN_EQUIPMENT)

    def test_journal_does_not_invent_reason(self):
        from apps.welding import card_access as ca

        # по базе допущен, а узел отказал — так и пишем
        same = self.tap("00aa0001", False, 1)
        self.assertEqual(same.reason, ca.UNDETERMINED)
        # узел решал по старому списку — это видно в причине
        stale = self.tap("00aa0001", False, 2, cards_ver="")
        self.assertTrue(stale.reason.startswith(ca.UNDETERMINED))
        self.assertIn("на узле был список v=—", stale.reason)

    def test_journal_accepted_rows_and_snapshots(self):
        service = self.tap("007d6a16", True, 1, age=2.5)
        self.assertTrue(service.accepted)
        self.assertEqual(service.reason, "")
        self.assertEqual(service.welder_name, "007D6A16")
        self.assertEqual(service.equipment_name, "Аппарат")
        self.assertEqual(service.card_uid, "007d6a16")
        self.assertEqual(service.tapped_at, T0 - timedelta(seconds=2.5))
        # узел пустил того, кого по базе пускать нельзя — видно в причине
        odd = self.tap("00aa0006", True, 2)
        self.assertIn("по данным портала", odd.reason)

    def test_journal_one_row_per_event_across_restart(self):
        from apps.welding.models import CardTap, NodeState

        NodeState.objects.create(node_id="node-c")
        st = {"tap_seq": 9, "tap_uid": "00AA0003", "tap_ok": False, "tap_age": 0, "cards_ver": ""}
        NodePoller("node-c", "127.0.0.1", FakeSink()).log_tap(st, T0)
        restarted = NodePoller("node-c", "127.0.0.1", FakeSink())
        restarted.log_tap(st, T0)
        restarted.log_tap(st, T0)
        self.assertEqual(CardTap.objects.count(), 1)
