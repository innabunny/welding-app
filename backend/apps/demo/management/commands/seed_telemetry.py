# apps/demo/management/commands/seed_telemetry.py
#
# Наполняет базу правдоподобной телеметрией, чтобы верстать экраны
# не по пустому месту.
#
# Запуск:
#   python manage.py seed_telemetry            один закрытый сеанс
#   python manage.py seed_telemetry --live     сеанс, который идёт сейчас
#   python manage.py seed_telemetry --clear    стереть ранее созданное
#
# Команда намеренно НЕ требует заведённых деталей и техкарт: сеанс
# в режиме «отработка» привязан только к аппарату, и этого довольно,
# чтобы экраны ожили. Если в базе найдётся операция с картой,
# команда дополнительно свяжет сеанс с деталью и проходами.

import os
import random
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.equipment.models import Equipment
from apps.welders.models import Welder
from apps.welding.models import (
    ArcRun,
    Deviation,
    NodeState,
    WeldingSession,
)

# Признак, по которому команда находит свои записи при --clear.
# Проставляется в external_id, чтобы не трогать настоящие данные
MARK = "seed-"


class Command(BaseCommand):
    help = "Создать демонстрационную телеметрию для вёрстки экранов"

    def add_arguments(self, parser):
        parser.add_argument(
            "--live", action="store_true",
            help="сеанс не закрыт: как будто сварка идёт прямо сейчас",
        )
        parser.add_argument(
            "--clear", action="store_true",
            help="удалить созданное этой командой и выйти",
        )
        parser.add_argument(
            "--node", default=None,
            help="узел, по умолчанию первый с заполненным node_id",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            return self.clear()

        equipment = self.find_equipment(options["node"])
        welder = Welder.objects.filter(is_active=True).first()

        now = timezone.localtime()

        if options["live"]:
            # начался двадцать минут назад и ещё идёт
            started = now - timedelta(minutes=20)
            finished = None
        else:
            # закончился час назад, длился сорок минут
            started = now - timedelta(hours=1, minutes=40)
            finished = started + timedelta(minutes=40)

        session = self.make_session(equipment, welder, started, finished)
        arcs = self.make_arcs(session, started, finished or now)
        self.make_deviation(session, arcs)
        self.make_samples(session, arcs, equipment)
        self.touch_node(equipment)

        self.stdout.write(self.style.SUCCESS(
            f"\nСеанс {session.external_id} создан на «{equipment.name}»"
        ))
        self.stdout.write(f"  участков дуги: {len(arcs)}")
        self.stdout.write(f"  сварщик: {session.welder_name or 'не определён'}")
        self.stdout.write(f"  узел: {equipment.node_id}")
        if finished is None:
            self.stdout.write("  сеанс НЕ закрыт — на экране будет «варит сейчас»")
        self.stdout.write(
            f"\nПосмотреть: /api/welding-sessions/{session.id}/\n"
            f"Стереть:    python manage.py seed_telemetry --clear\n"
        )

    # ------------------------------------------------------------------

    def find_equipment(self, node):
        """Аппарат, к которому привязать сеанс."""
        qs = Equipment.objects.filter(is_active=True)

        if node:
            equipment = qs.filter(node_id=node).first()
            if equipment is None:
                raise CommandError(f"Нет оборудования с node_id = {node}")
            return equipment

        equipment = qs.filter(node_id__isnull=False).exclude(node_id="").first()
        if equipment is not None:
            return equipment

        # ни у одного аппарата не заполнен node_id — поставим его первому,
        # иначе не к чему привязывать состояние узла
        equipment = qs.first()
        if equipment is None:
            raise CommandError(
                "В базе нет оборудования. Загрузите справочники: "
                "python manage.py loaddata seed.json"
            )
        equipment.node_id = "node-01"
        equipment.save(update_fields=["node_id"])
        self.stdout.write(self.style.WARNING(
            f"У «{equipment.name}» не было узла — проставил node-01"
        ))
        return equipment

    def make_session(self, equipment, welder, started, finished):
        """Сеанс в режиме «отработка».

        Отработка выбрана намеренно: такой сеанс не требует ни детали,
        ни техкарты — ровно то, что бывает на настоящем производстве,
        когда сварщик подбирает режим.
        """
        external_id = f"{MARK}{equipment.node_id}-{int(started.timestamp())}"

        session = WeldingSession.objects.create(
            equipment=equipment,
            welder=welder,
            mode=WeldingSession.Mode.TRIAL,
            external_id=external_id,
            started_at=started,
            finished_at=finished,
        )
        return session

    def make_arcs(self, session, started, until):
        """Участки дуги: три прохода на стыке 13 мм.

        Корень на малом токе, заполнение на большом, облицовка средняя.
        Между проходами паузы — деталь крутят, шов остывает.
        """
        plan = [
            # (минут горения, ток средний, разброс, пауза после, подпись)
            (6, 100, 10, 4, "корневой"),
            (9, 150, 12, 5, "заполнение"),
            (7, 135, 10, 0, "облицовочный"),
        ]

        arcs = []
        moment = started + timedelta(seconds=40)   # поджиг не сразу

        for minutes, i_avg, spread, pause, label in plan:
            arc_end = moment + timedelta(minutes=minutes)
            if arc_end > until:
                # для живого сеанса последние проходы ещё не начались
                if moment >= until:
                    break
                arc_end = None

            arc = ArcRun.objects.create(
                session=session,
                started_at=moment,
                finished_at=arc_end,
                current_avg=i_avg,
                current_min=i_avg - spread,
                current_max=i_avg + spread,
                voltage_avg=round(11.5 + i_avg / 200, 1),
                pulse_freq=2.35,
                telemetry_complete=arc_end is not None,
            )
            arcs.append(arc)
            self.stdout.write(f"  проход {label}: {minutes} мин, {i_avg} А")

            if arc_end is None:
                break
            moment = arc_end + timedelta(minutes=pause)

        return arcs

    def make_deviation(self, session, arcs):
        """Одно отклонение по току на корневом проходе.

        Просадка ниже допуска на двенадцать секунд — то, из-за чего
        и затевалась вся система.
        """
        if not arcs:
            return

        root = arcs[0]
        at = root.started_at + timedelta(minutes=2, seconds=30)

        Deviation.objects.create(
            session=session,
            parameter=Deviation.Parameter.CURRENT,
            severity=Deviation.Severity.WARNING,
            planned_min=90,
            planned_max=110,
            actual_value=82.4,
            deviation_percent=-8.4,
            started_at=at,
            finished_at=at + timedelta(seconds=12),
            duration=timedelta(seconds=12),
            reviewed=False,
        )
        self.stdout.write("  отклонение: ток 82,4 А при допуске 90–110, 12 с")

    def make_samples(self, session, arcs, equipment):
        """Замеры в ClickHouse: по десять точек в секунду.

        Для вёрстки графика нужны настоящие точки, иначе не видно
        ни коридора разброса, ни разрывов между проходами.
        """
        try:
            from apps.welding.clickhouse import get_client
            client = get_client()
        except Exception as exc:
            self.stdout.write(self.style.WARNING(
                f"  ClickHouse недоступен ({exc}) — график будет пустым"
            ))
            return

        rows = []
        for arc in arcs:
            end = arc.finished_at or timezone.localtime()
            seconds = int((end - arc.started_at).total_seconds())
            base = float(arc.current_avg)
            spread = float(arc.current_max) - base

            for tick in range(seconds * 10):
                moment = arc.started_at + timedelta(milliseconds=tick * 100)

                # лёгкое блуждание вокруг среднего плюс редкие выбросы
                wobble = random.uniform(-spread * 0.4, spread * 0.4)
                if random.random() < 0.01:
                    wobble = random.uniform(-spread, spread)

                i_avg = round(base + wobble, 1)
                rows.append((
                    arc.id,
                    session.external_id,
                    equipment.node_id,
                    moment,
                    i_avg,
                    round(i_avg - abs(wobble) * 0.3, 1),
                    round(i_avg + abs(wobble) * 0.3, 1),
                    round(float(arc.voltage_avg) + random.uniform(-0.4, 0.4), 2),
                ))

        if not rows:
            return

        client.execute(
            "INSERT INTO welding.samples "
            "(arc_id, session_id, node, at, i_avg, i_min, i_max, u_avg) VALUES",
            rows,
        )
        self.stdout.write(f"  замеров в ClickHouse: {len(rows)}")

    def touch_node(self, equipment):
        """Состояние узла: на связи, данные не копятся."""
        NodeState.objects.update_or_create(
            node_id=equipment.node_id,
            defaults={
                "equipment": equipment,
                "last_seen_at": timezone.now(),
                "last_status_at": timezone.now(),
                "is_online": True,
                "queued": 0,
                "ip": equipment.node_ip or "192.168.1.177",
                "firmware": "0.4-demo",
                "uptime_seconds": 7200,
                "free_bytes": 1_100_000,
                "temperature": 41.5,
                "reset_reason": "poweron",
            },
        )

    # ------------------------------------------------------------------

    def clear(self):
        """Удалить созданное этой командой.

        Опознаём по префиксу в external_id, поэтому настоящие данные
        от узла не пострадают.
        """
        sessions = WeldingSession.objects.filter(external_id__startswith=MARK)
        ids = list(sessions.values_list("external_id", flat=True))

        if not ids:
            self.stdout.write("Нечего удалять")
            return

        # сначала ClickHouse: после удаления сеансов не узнать,
        # какие именно замеры были демонстрационными
        try:
            from apps.welding.clickhouse import get_client
            get_client().execute(
                "ALTER TABLE welding.samples DELETE WHERE session_id IN %(ids)s",
                {"ids": tuple(ids)},
            )
            self.stdout.write("Замеры в ClickHouse помечены на удаление")
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f"ClickHouse: {exc}"))

        # участки дуги и отклонения уйдут каскадом
        count = sessions.count()
        sessions.delete()
        self.stdout.write(self.style.SUCCESS(f"Удалено сеансов: {count}"))
