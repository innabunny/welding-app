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
