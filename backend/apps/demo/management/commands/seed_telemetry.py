# apps/demo/management/commands/seed_telemetry.py
#
# Наполняет базу правдоподобной телеметрией, чтобы верстать экраны
# не по пустому месту.
#
# Запуск:
#   python manage.py seed_telemetry            один закрытый сеанс
#   python manage.py seed_telemetry --live     сеанс, который идёт сейчас
#   python manage.py seed_telemetry --clear    стереть ранее созданное
#   python manage.py seed_telemetry --with-card          сеанс по техпроцессу:
#       деталь, шов, операция, выпущенная карта с проходами. Токи участков
#       и отклонение берутся из допусков карты. Можно вместе с --live
#
# Команда намеренно НЕ требует заведённых деталей и техкарт: сеанс
# в режиме «отработка» привязан только к аппарату, и этого довольно,
# чтобы экраны ожили. Если в базе найдётся операция с картой,
# команда дополнительно свяжет сеанс с деталью и проходами.

import random
from decimal import Decimal
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.equipment.models import Equipment
from apps.welders.models import Welder
from apps.technology.models import Operation, Part, SeamSpec
from apps.welding.models import (
    ArcRun,
    Deviation,
    NodeState,
    OperationRun,
    PartInstance,
    Weld,
    WeldingSession,
    WeldPassRun,
)
from apps.weldingcards.models import WeldingCard, WeldPass

# Признак, по которому команда находит свои записи при --clear.
# Проставляется в external_id, чтобы не трогать настоящие данные
MARK = "seed-"

# Минимальный набор технологии, если подходящей карты в базе нет.
# Номер детали с этим префиксом — признак для --clear
SEED_PART = "SEED-13"

# Проходы стыка 13 мм: (минут горения, пауза после, подпись)
PASS_TIMING = [(6, 4, "корневой"), (9, 5, "заполнение"), (7, 0, "облицовочный")]

# Как определена граница прохода — по разной достоверности на каждый,
# чтобы на экране было видно все варианты
MATCH_SOURCES = [
    WeldPassRun.MatchSource.SENSOR,
    WeldPassRun.MatchSource.CURRENT,
    WeldPassRun.MatchSource.CALCULATED,
]


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
            "--with-card", action="store_true",
            help="сеанс по техпроцессу с деталью, операцией и картой",
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

        card = self.find_card(equipment) if options["with_card"] else None
        plan = self.plan_from_card(card) if card else self.default_plan()

        session = self.make_session(equipment, welder, started, finished, card is not None)
        arcs = self.make_arcs(session, started, finished or now, plan)
        if card:
            self.link_to_card(session, card, arcs, plan, welder, equipment, started, finished)
        deviation = self.make_deviation(session, arcs, plan)
        self.make_samples(session, arcs, equipment, deviation)
        self.touch_node(equipment)

        self.stdout.write(self.style.SUCCESS(
            f"\nСеанс {session.external_id} создан на «{equipment.name}»"
        ))
        self.stdout.write(f"  участков дуги: {len(arcs)}")
        self.stdout.write(f"  сварщик: {session.welder_name or 'не определён'}")
        self.stdout.write(f"  узел: {equipment.node_id}")
        if session.operation_run_id:
            run = session.operation_run
            self.stdout.write(
                f"  по техпроцессу: {run.weld.instance}, шов {run.weld.seam.number}, "
                f"операция {run.operation.number}, карта {run.card.card_no}"
            )
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

    def make_session(self, equipment, welder, started, finished, routine=False):
        """Сеанс в режиме «отработка», а с --with-card — «по техпроцессу».

        Отработка не требует ни детали, ни техкарты — ровно то, что
        бывает на настоящем производстве, когда сварщик подбирает режим.
        Связь с операцией для режима «по техпроцессу» ставит link_to_card.
        """
        external_id = f"{MARK}{equipment.node_id}-{int(started.timestamp())}"

        session = WeldingSession.objects.create(
            equipment=equipment,
            welder=welder,
            mode=WeldingSession.Mode.ROUTINE if routine else WeldingSession.Mode.TRIAL,
            external_id=external_id,
            started_at=started,
            finished_at=finished,
        )
        return session

    # ------------------------------------------------------------------
    # План проходов: ток, разброс, напряжение, и допуск, если есть карта

    def default_plan(self):
        """Без карты: токи как раньше, допуск только у корневого прохода
        для отклонения — 90–110 А."""
        currents = [(100, 10, 90, 110), (150, 12, None, None), (135, 10, None, None)]
        return [
            {
                "minutes": minutes, "pause": pause, "label": label,
                "i_avg": i, "spread": spread,
                "u_avg": round(11.5 + i / 200, 1),
                "i_min": lo, "i_max": hi, "weld_pass": None,
            }
            for (minutes, pause, label), (i, spread, lo, hi) in zip(PASS_TIMING, currents)
        ]

    def plan_from_card(self, card):
        """Токи участков из допусков карты: середина диапазона,
        разброс внутри него. Иначе все участки вышли бы за допуск."""
        passes = [p for p in card.passes.order_by("no") if p.current_min and p.current_max][:3]
        plan = []
        for (minutes, pause, label), p in zip(PASS_TIMING, passes):
            lo, hi = float(p.current_min), float(p.current_max)
            if p.voltage_min is not None and p.voltage_max is not None:
                u = round((float(p.voltage_min) + float(p.voltage_max)) / 2, 1)
            else:
                u = round(11.5 + (lo + hi) / 400, 1)
            plan.append({
                "minutes": minutes, "pause": pause, "label": label,
                "i_avg": round((lo + hi) / 2), "spread": round((hi - lo) / 2 * 0.8, 1),
                "u_avg": u, "i_min": lo, "i_max": hi, "weld_pass": p,
            })
        # последний проход — облицовочный, сколько бы их ни было
        if len(plan) > 1:
            plan[-1]["label"] = "облицовочный"
            plan[-1]["pause"] = 0
        return plan

    def find_card(self, equipment):
        """Выпущенная карта с допусками по току.

        Сначала ищем в базе: трёхпроходную того же способа, что
        у аппарата, потом любую. Если нет ни одной — создаём минимальный
        набор: деталь, шов 13 мм, операцию и карту с тремя проходами.
        """
        cards = [
            c for c in WeldingCard.objects.filter(is_released=True)
            .select_related("operation__part", "operation__seam")
            .prefetch_related("passes")
            if any(p.current_min and p.current_max for p in c.passes.all())
        ]
        if cards:
            cards.sort(key=lambda c: (
                len(c.passes.all()) != 3,
                c.method_id != equipment.method_id,
                c.id,
            ))
            card = cards[0]
            self.stdout.write(f"  карта из базы: {card.card_no}")
            return card
        return self.make_minimal_card(equipment)

    def make_minimal_card(self, equipment):
        part, _ = Part.objects.get_or_create(
            number=SEED_PART, defaults={"name": "Обечайка демонстрационная"},
        )
        seam, _ = SeamSpec.objects.get_or_create(
            part=part, number="1",
            defaults={
                "joint_type": "стыковое",
                "thickness_1": Decimal("13"), "thickness_2": Decimal("13"),
                "seam_length": Decimal("940"),
            },
        )
        operation, _ = Operation.objects.get_or_create(
            part=part, number="010",
            defaults={"seam": seam, "name": "Сварка стыка", "order": 10},
        )
        card, created = WeldingCard.objects.get_or_create(
            operation=operation,
            defaults={
                "card_no": f"{SEED_PART}-010",
                "method_id": equipment.method_id,
                "equipment": equipment,
                "is_released": True,
            },
        )
        if created:
            for no, (lo, hi, ulo, uhi) in enumerate(
                [(90, 110, 10, 12), (140, 160, 11, 13), (125, 145, 11, 13)], start=1,
            ):
                WeldPass.objects.create(
                    card=card, no=no,
                    current_min=lo, current_max=hi,
                    voltage_min=ulo, voltage_max=uhi,
                )
        self.stdout.write(self.style.WARNING(
            f"  подходящей карты в базе нет — создал {card.card_no} "
            f"(деталь {SEED_PART}, шов 1, операция 010)"
        ))
        return card

    def link_to_card(self, session, card, arcs, plan, welder, equipment, started, finished):
        """Экземпляр детали, шов, выполнение операции и проходы по факту.

        Заводской номер с префиксом seed- — по нему --clear найдёт
        и удалит экземпляр вместе со швом и проходами.
        """
        operation = card.operation
        instance = PartInstance.objects.create(
            part=operation.part, serial_no=f"{MARK}{int(started.timestamp())}",
        )
        weld = Weld.objects.create(instance=instance, seam=operation.seam)
        run = OperationRun.objects.create(
            weld=weld, operation=operation, card=card,
            welder=welder, equipment=equipment,
            started_at=started, finished_at=finished,
            status=OperationRun.Status.DONE if finished else OperationRun.Status.IN_WORK,
        )
        for no, (arc, step) in enumerate(zip(arcs, plan), start=1):
            pass_run = WeldPassRun.objects.create(
                run=run, no=no, planned_pass=step["weld_pass"],
                started_at=arc.started_at, finished_at=arc.finished_at,
                arc_time=arc.duration,
                match_source=MATCH_SOURCES[(no - 1) % len(MATCH_SOURCES)],
            )
            arc.pass_run = pass_run
            arc.save(update_fields=["pass_run"])
        session.operation_run = run
        session.save(update_fields=["operation_run"])

    def make_arcs(self, session, started, until, plan):
        """Участки дуги: по одному на проход.

        Без карты — три прохода на стыке 13 мм: корень на малом токе,
        заполнение на большом, облицовка средняя. Между проходами
        паузы — деталь крутят, шов остывает.
        """
        arcs = []
        moment = started + timedelta(seconds=40)   # поджиг не сразу

        for step in plan:
            arc_end = moment + timedelta(minutes=step["minutes"])
            if arc_end > until:
                # для живого сеанса последние проходы ещё не начались
                if moment >= until:
                    break
                arc_end = None

            i_avg, spread = step["i_avg"], step["spread"]
            arc = ArcRun.objects.create(
                session=session,
                started_at=moment,
                finished_at=arc_end,
                current_avg=i_avg,
                current_min=round(i_avg - spread, 1),
                current_max=round(i_avg + spread, 1),
                voltage_avg=step["u_avg"],
                pulse_freq=2.35,
                telemetry_complete=arc_end is not None,
            )
            arcs.append(arc)
            self.stdout.write(f"  проход {step['label']}: {step['minutes']} мин, {i_avg} А")

            if arc_end is None:
                break
            moment = arc_end + timedelta(minutes=step["pause"])

        return arcs

    def make_deviation(self, session, arcs, plan):
        """Одно отклонение по току на корневом проходе.

        Просадка ниже допуска на двенадцать секунд — то, из-за чего
        и затевалась вся система. Допуск — из карты, если она есть.
        """
        if not arcs:
            return None

        root = arcs[0]
        lo, hi = plan[0]["i_min"], plan[0]["i_max"]
        actual = round(lo * 0.916, 1)
        at = root.started_at + timedelta(minutes=2, seconds=30)

        deviation = Deviation.objects.create(
            session=session,
            pass_run=root.pass_run,
            parameter=Deviation.Parameter.CURRENT,
            severity=Deviation.Severity.WARNING,
            planned_min=lo,
            planned_max=hi,
            actual_value=actual,
            deviation_percent=round((actual - lo) / lo * 100, 1),
            started_at=at,
            finished_at=at + timedelta(seconds=12),
            duration=timedelta(seconds=12),
            reviewed=False,
        )
        self.stdout.write(f"  отклонение: ток {actual} А при допуске {lo:g}–{hi:g}, 12 с")
        return deviation

    def make_samples(self, session, arcs, equipment, deviation=None):
        """Замеры в ClickHouse: по десять точек в секунду.

        Для вёрстки графика нужны настоящие точки, иначе не видно
        ни коридора разброса, ни разрывов между проходами, ни просадки
        на месте отклонения.
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
                # отклонение должно быть видно и на графике: в его окне
                # ток проседает до записанного значения
                if deviation and deviation.started_at <= moment <= deviation.finished_at:
                    i_avg = round(float(deviation.actual_value) + random.uniform(-1.5, 1.5), 1)
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
            self.stdout.write("Сеансов от этой команды нет")

        if ids:
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

        # экземпляры детали от --with-card; шов, выполнение операции
        # и проходы по факту удаляются вместе с ними каскадом
        instances = PartInstance.objects.filter(serial_no__startswith=MARK)
        if instances.exists():
            self.stdout.write(f"Удалено экземпляров деталей: {instances.count()}")
            instances.delete()

        # минимальный набор технологии. Карта держит операцию (PROTECT),
        # поэтому сначала карта, потом операция, шов и деталь
        parts = Part.objects.filter(number=SEED_PART)
        if parts.exists():
            WeldingCard.objects.filter(operation__part__in=parts).delete()
            Operation.objects.filter(part__in=parts).delete()
            SeamSpec.objects.filter(part__in=parts).delete()
            parts.delete()
            self.stdout.write(f"Удалена демонстрационная деталь {SEED_PART} с картой")
