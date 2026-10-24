from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.equipment.models import Equipment
from apps.methods.models import WeldingMethod
from apps.welding.models import ArcRun, WeldingSession

from .cleanup import close_demo_sessions


class CloseDemoSessionsTests(TestCase):
    def setUp(self):
        method = WeldingMethod.objects.create(id="tig-t", name="РИН", process=WeldingMethod.Process.choices[0][0])
        self.equipment = Equipment.objects.create(name="Аппарат", method=method)
        self.week_ago = timezone.now() - timedelta(days=7)

    def test_closes_demo_session_and_its_arc(self):
        s = WeldingSession.objects.create(equipment=self.equipment, mode="отработка", started_at=self.week_ago)
        arc = ArcRun.objects.create(session=s, started_at=self.week_ago)

        self.assertEqual(close_demo_sessions(), 1)

        s.refresh_from_db()
        arc.refresh_from_db()
        self.assertEqual(arc.finished_at, self.week_ago + timedelta(minutes=2))
        self.assertEqual(s.finished_at, arc.finished_at)

    def test_node_session_is_never_touched(self):
        # у сеанса с настоящего узла external_id есть всегда
        s = WeldingSession.objects.create(
            equipment=self.equipment, mode="отработка", started_at=self.week_ago, external_id="node-01-1",
        )
        self.assertEqual(close_demo_sessions(), 0)
        s.refresh_from_db()
        self.assertIsNone(s.finished_at)
