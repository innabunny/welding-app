"""Имитация производства для демо.

Поверх справочников из fixtures/seed.json заводит людей, детали,
техкарты, аттестации, заявки и шесть недель сварки с телеметрией
и контролем. Даты считаются от сегодняшнего дня, поэтому плашки
рабочего стола всегда «свежие».

    python manage.py loaddata fixtures/seed.json
    python manage.py seed_demo            # в пустую базу
    python manage.py seed_demo --reset    # стереть демо и завести заново

Случайность фиксирована (--seed), так что при одинаковом запуске
данные получаются одинаковыми.
"""

import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.attestation.models import Attestation, AttestationItem, AttestationRule
from apps.equipment.models import Equipment
from apps.materials.models import FillerMaterial, GasFlux, Material, MaterialGroup
from apps.service.models import ServiceRequest
from apps.technology.models import Operation, Part, SeamSpec
from apps.welders.models import Welder
from apps.welding.models import (
    ArcRun,
    Inspection,
    OperationRun,
    PartInstance,
    RouteCode,
    Weld,
    WeldingSession,
    WeldPassRun,
)
from apps.weldingcards.models import WeldingCard, WeldPass
from apps.workshops.models import Workshop

DEMO_PASSWORD = "demo"

USERS = [
    ("admin", "Администратор Портала", "admin", None),
    ("technolog", "Соколова Елена Викторовна", "technologist", 1),
    ("master", "Кузнецов Андрей Петрович", "master", 1),
    ("master7", "Лебедев Олег Иванович", "master", 2),
    ("mechanic", "Морозов Сергей Николаевич", "mechanic", 1),
    ("control", "Волкова Ирина Сергеевна", "inspector", 1),
]

WELDERS = [
    ("Смирнов Алексей Викторович", 1, "6", 2004),
    ("Попов Дмитрий Андреевич", 1, "5", 2011),
    ("Васильев Николай Петрович", 1, "6", 1998),
    ("Новиков Игорь Сергеевич", 1, "4", 2019),
    ("Фёдоров Артём Олегович", 1, "5", 2014),
    ("Михайлов Павел Юрьевич", 1, "5", 2009),
    ("Егоров Роман Алексеевич", 1, "3", 2022),
    ("Павлов Виктор Михайлович", 2, "6", 1995),
    ("Семёнов Кирилл Дмитриевич", 2, "5", 2012),
    ("Голубев Максим Игоревич", 2, "4", 2017),
    ("Виноградов Евгений Павлович", 1, "5", 2010),
    ("Богданов Юрий Николаевич", 2, "6", 2001),
]

# № по чертежу, наименование, швы: (№, толщина 1, толщина 2, вид, диаметр, длина)
PARTS = [
    ("14.301", "Корпус камеры сгорания", [
        ("1", "3.0", "3.0", "кольцевой", "320", None),
        ("2", "3.0", "2.5", "кольцевой", "280", None),
        ("3", "13.0", "13.0", "прямой", None, "640"),
    ]),
    ("14.315", "Коллектор подачи горючего", [
        ("1", "2.0", "2.0", "кольцевой", "86", None),
        ("2", "1.5", "2.0", "кольцевой", "42", None),
    ]),
    ("22.110", "Патрубок выходной", [
        ("1", "4.0", "4.0", "кольцевой", "140", None),
    ]),
    ("22.140", "Фланец переходной", [
        ("1", "6.0", "6.0", "кольцевой", "210", None),
        ("2", "6.0", "4.0", "прямой", None, "180"),
    ]),
    ("31.020", "Кронштейн крепления", [
        ("1", "2.5", "2.5", "прямой", None, "120"),
        ("2", "2.5", "2.5", "прямой", None, "95"),
    ]),
    ("31.045", "Трубопровод дренажный", [
        ("1", "1.0", "1.0", "кольцевой", "18", None),
    ]),
    ("40.500", "Опора теплообменника", [
        ("1", "8.0", "8.0", "прямой", None, "420"),
    ]),
]

SERVICE = [
    ("неисправность", "высокая", "Дуга рвётся на токах выше 150 А, на табло периодически ошибка E-07. Заметили утром в первую смену."),
    ("ремонт", "средняя", "Треснул корпус горелки, газ подтекает у рукоятки."),
    ("то", "низкая", "Плановое ТО по графику: чистка, замена фильтров, проверка контуров охлаждения."),
    ("диагностика", "средняя", "Ток на табло и по клещам расходится на 8–10 А. Нужна проверка калибровки."),
    ("неисправность", "высокая", "Не включается подача проволоки, мотор гудит, ролики не крутятся."),
    ("ремонт", "средняя", "Разболтался разъём обратного кабеля, греется."),
    ("то", "низкая", "Замена охлаждающей жидкости, по регламенту раз в полгода."),
    ("диагностика", "низкая", "Шумит вентилятор блока питания, раньше такого не было."),
    ("неисправность", "средняя", "Не держит вакуум: за 10 минут давление поднимается до 5·10⁻² Па."),
    ("ремонт", "высокая", "Не вращается планшайба вращателя, заклинило редуктор."),
    ("то", "низкая", "Проверка и чистка сопел, замена цанг."),
    ("диагностика", "средняя", "Импульсный режим: пауза длиннее заданной примерно на 20%."),
    ("неисправность", "средняя", "Периодически пропадает защитный газ — клапан срабатывает с задержкой."),
    ("ремонт", "низкая", "Порван кожух шланг-пакета, нужна замена."),
]

RESOLUTIONS = [
    "Заменена плата управления источника, проверено на пробном шве.",
    "Заменён корпус горелки и уплотнения.",
    "Выполнено ТО по регламенту, замечаний нет.",
    "Проведена калибровка по эталонному шунту, расхождение 1 А.",
    "Заменены ролики подачи и щётки мотора.",
    "Разъём обжат заново, контакт зачищен.",
    "Жидкость заменена, контур промыт.",
]

REJECTIONS = [
    "Неисправность не подтвердилась: установка работает штатно.",
    "Дубль заявки — работы выполняются по заявке, поданной раньше.",
]


class Command(BaseCommand):
    help = "Заводит демо-производство поверх справочников из seed.json"

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Стереть прошлые демо-данные")
        parser.add_argument("--seed", type=int, default=7, help="Зерно случайности")
        parser.add_argument("--weeks", type=int, default=6, help="Сколько недель производства")

    def handle(self, *args, reset, seed, weeks, **options):
        if not Equipment.objects.exists() or not Material.objects.exists():
            raise CommandError("Сначала справочники: python manage.py loaddata fixtures/seed.json")
        if Part.objects.exists() and not reset:
            raise CommandError("В базе уже есть детали. Чтобы завести демо заново, добавьте --reset")

        self.rng = random.Random(seed)
        self.now = timezone.now()
        self.today = timezone.localdate()

        with transaction.atomic():
            if reset:
                self._reset()
            self._users()
            self._welders()
            self._attestations()
            self._technology()
            self._cards()
            self._production(weeks)
            self._loose_sessions()
            self._service()

        self.stdout.write(self.style.SUCCESS(self._summary()))

    # ---------- служебное ----------

    def _reset(self):
        """Удаляем в порядке зависимостей: у многих связей PROTECT."""
        Inspection.objects.all().delete()
        ArcRun.objects.all().delete()
        WeldingSession.objects.all().delete()
        WeldPassRun.objects.all().delete()
        OperationRun.objects.all().delete()
        RouteCode.objects.all().delete()
        Weld.objects.all().delete()
        PartInstance.objects.filter(witness_for__isnull=False).delete()
        PartInstance.objects.all().delete()
        WeldingCard.objects.all().delete()
        Operation.objects.all().delete()
        SeamSpec.objects.all().delete()
        Part.objects.all().delete()
        AttestationItem.objects.all().delete()
        Attestation.objects.all().delete()
        AttestationRule.objects.all().delete()
        Welder.objects.all().delete()
        ServiceRequest.objects.all().delete()
        User.objects.filter(username__in=[u[0] for u in USERS]).delete()

    def at(self, days_ago, hour=None, minute=None):
        """Момент в рабочую смену N дней назад."""
        d = self.today - timedelta(days=days_ago)
        h = hour if hour is not None else self.rng.randint(8, 16)
        m = minute if minute is not None else self.rng.choice([0, 10, 15, 20, 30, 40, 45, 50])
        moment = timezone.make_aware(datetime.combine(d, time(h, m)))
        # сегодняшняя смена не может быть в будущем
        return min(moment, self.now - timedelta(minutes=5))

    @staticmethod
    def dec(value, places=1):
        return Decimal(str(round(value, places)))

    def _summary(self):
        rows = [
            ("пользователей (пароль «demo»)", User.objects.filter(username__in=[u[0] for u in USERS]).count()),
            ("сварщиков", Welder.objects.count()),
            ("аттестаций", Attestation.objects.count()),
            ("деталей", Part.objects.count()),
            ("операций", Operation.objects.count()),
            ("техкарт", WeldingCard.objects.count()),
            ("изделий", PartInstance.objects.count()),
            ("сваренных швов", Weld.objects.count()),
            ("выполнений операций", OperationRun.objects.count()),
            ("сеансов сварки", WeldingSession.objects.count()),
            ("участков дуги", ArcRun.objects.count()),
            ("заключений контроля", Inspection.objects.count()),
            ("заявок на обслуживание", ServiceRequest.objects.count()),
        ]
        width = max(len(r[0]) for r in rows)
        return "Демо-производство заведено:\n" + "\n".join(f"  {name:<{width}}  {n}" for name, n in rows)

    # ---------- люди ----------

    def _users(self):
        self.users = {}
        for login, name, role, workshop in USERS:
            user, _ = User.objects.get_or_create(username=login)
            user.name, user.role, user.workshop_id, user.is_active = name, role, workshop, True
            # админке нужен флаг сотрудника — пусть демо-админ заходит и туда
            user.is_staff = user.is_superuser = role == "admin"
            user.set_password(DEMO_PASSWORD)
            user.save()
            self.users[login] = user

    def _welders(self):
        self.welders = []
        for i, (fio, workshop, rank, since) in enumerate(WELDERS):
            self.welders.append(Welder.objects.create(
                fio=fio,
                personnel_no=str(1040 + i * 7),
                birth_date=date(since - self.rng.randint(19, 24), self.rng.randint(1, 12), self.rng.randint(1, 28)),
                education=self.rng.choice(["Среднее профессиональное", "Среднее профессиональное", "Высшее техническое"]),
                workshop_id=workshop,
                welding_since=date(since, self.rng.randint(1, 12), 1),
                rank=rank,
                rfid_uid=f"{self.rng.getrandbits(32):08x}",
                is_active=True,
            ))
        # один уволился — для фильтра «только работающие»
        self.welders[-1].is_active = False
        self.welders[-1].save()

    # ---------- аттестация ----------

    def _attestations(self):
        steels = MaterialGroup.objects.get(pk=1)
        for method, th_from, th_to, output in [
            ("tig1", "0.5", "5.0", {"ВИК": "годен", "РК": "годен", "Угол загиба": "не менее 150°"}),
            ("tig1", "5.0", None, {"ВИК": "годен", "РК": "годен", "Разрыв": "не ниже основного металла"}),
            ("tig2", "0.5", "8.0", {"ВИК": "годен", "РК": "годен", "МК": "без трещин"}),
            ("mig", "2.0", None, {"ВИК": "годен", "УЗК": "годен", "Угол загиба": "не менее 120°"}),
        ]:
            AttestationRule.objects.create(
                method_id=method, group=steels, th_from=Decimal(th_from),
                th_to=Decimal(th_to) if th_to else None, required_output=output,
            )

        tungsten = FillerMaterial.objects.filter(kind="присадочная проволока").first()
        argon = GasFlux.objects.get(pk=1)
        committee = ("Соколова Е. В.", "Кузнецов А. П.", "Григорьев В. А.")

        # сварщик → способы; срок: сколько дней назад аттестован (3 года = 1095 дней)
        plan = [
            (0, "tig1", 300), (0, "tig2", 1070),      # второй допуск истекает через ~25 дней
            (1, "tig1", 600), (2, "tig1", 1120),      # просрочен
            (2, "tig3", 200), (3, "tig1", 90),
            (4, "tig2", 1050), (5, "mig", 400),       # истекает через ~45 дней
            (6, "tig1", 30), (7, "ebw", 500),
            (8, "plasma", 700), (9, "diff", 250),
            (10, "tig1", 1200), (10, "mig", 150),     # просрочен и действующий
            (11, "tig4", 900),
        ]
        protocol = 101
        for welder_idx, method, days in plan:
            attested = self.today - timedelta(days=days)
            a = Attestation.objects.create(
                welder=self.welders[welder_idx], method_id=method, group=steels,
                controls=["вик", "рк"], status="done",
                kind="периодическая" if days > 700 else "первичная",
                attested_at=attested,
                protocol_no=f"П-{protocol}/{attested:%y}", certificate_no=f"УД-{protocol + 400}",
                practical_eval="удовлетворительно",
                conclusion=f"Допущен к сварке способом {method.upper()} сталей и никелевых сплавов толщиной 0,5–8 мм.",
                chairman=committee[0], head_shop=committee[1], head_btk=committee[2],
            )
            self._items(a, tungsten, argon, results=True)
            protocol += 1

        # аттестации в работе — по одной на каждом этапе
        for welder_idx, method, status in [(3, "tig2", "draft"), (6, "tig2", "testing"), (1, "mig", "protocol"), (8, "tig1", "review")]:
            a = Attestation.objects.create(
                welder=self.welders[welder_idx], method_id=method, group=steels,
                controls=["вик", "рк"], status=status, kind="первичная",
                protocol_no="" if status in ("draft", "testing") else f"П-{protocol}/{self.today:%y}",
            )
            self._items(a, tungsten, argon, results=status in ("protocol", "review"))
            protocol += 1

    def _items(self, attestation, wire, gas, results):
        for n, (lo, hi) in enumerate([("1.0", "3.0"), ("3.0", "6.0")], start=1):
            AttestationItem.objects.create(
                attestation=attestation, sample_no=f"{attestation.pk}-{n}",
                material1_id=5, uniform=True,
                thickness_min=Decimal(lo), thickness_max=Decimal(hi),
                wire=wire, gas=gas, position="нижнее",
                vik_result="годен" if results else "",
                physical_protocol=f"РК-{self.rng.randint(300, 900)}" if results else "",
                tensile_strength=self.dec(self.rng.uniform(52, 58)) if results else None,
                bend_angle=Decimal("150.0") if results else None,
            )

    # ---------- технология ----------

    def _technology(self):
        self.operations = []  # (операция, шов)
        materials = list(Material.objects.all())
        for number, name, seams in PARTS:
            part = Part.objects.create(number=number, name=name)
            order = 10
            for seam_no, t1, t2, kind, diameter, length in seams:
                mat = self.rng.choice(materials)
                seam = SeamSpec.objects.create(
                    part=part, number=seam_no,
                    joint_type="Стыковое" if kind == "кольцевой" or self.rng.random() < 0.6 else "Угловое",
                    material_1=mat,
                    material_2=mat if t1 == t2 else self.rng.choice(materials),
                    thickness_1=Decimal(t1), thickness_2=Decimal(t2),
                    pos_1=str(self.rng.randint(1, 9)), pos_2=str(self.rng.randint(10, 19)),
                    seam_type=kind,
                    seam_diameter=Decimal(diameter) if diameter else None,
                    seam_length=Decimal(length) if length else self.dec(3.1416 * float(diameter), 1),
                )
                # толстый шов варится в два захода: корень и заполнение разными картами
                stages = [("сварка корня", ["ВИК"]), ("заполнение и облицовка", ["ВИК", "РК"])] \
                    if float(t1) >= 8 else [("сварка", ["ВИК", "РК"] if float(t1) >= 2.5 else ["ВИК"])]
                for title, controls in stages:
                    op = Operation.objects.create(
                        part=part, seam=seam, number=f"{order:03d}",
                        name=f"{title.capitalize()} шва {seam_no}", order=order,
                        required_controls=controls,
                    )
                    self.operations.append((op, seam))
                    order += 10
        # новая деталь, по которой технолог ещё не составил карты
        part = Part.objects.create(number="40.610", name="Рама теплообменника")
        seam = SeamSpec.objects.create(
            part=part, number="1", joint_type="Тавровое", material_1_id=5, material_2_id=5,
            thickness_1=Decimal("5.0"), thickness_2=Decimal("5.0"), seam_type="прямой", seam_length=Decimal("260"),
        )
        Operation.objects.create(part=part, seam=seam, number="010", name="Сварка рамы", order=10, required_controls=["ВИК"])

    def _cards(self):
        """Способ и установка — по толщине, как выбрал бы технолог."""
        by_method = {}
        for eq in Equipment.objects.prefetch_related("speed_units"):
            by_method.setdefault(eq.method_id, []).append(eq)

        wire = FillerMaterial.objects.filter(kind="присадочная проволока")
        tungsten = FillerMaterial.objects.filter(kind="вольфрам")
        argon = GasFlux.objects.get(pk=1)
        helium = GasFlux.objects.get(pk=2)
        technolog = self.users["technolog"]

        self.cards = []
        for n, (op, seam) in enumerate(self.operations, start=1):
            t = float(seam.thickness_1)
            method = "tig1" if t <= 2 else "tig2" if t <= 4 else "mig" if t >= 8 else self.rng.choice(["tig2", "tig3", "plasma"])
            equipment = self.rng.choice(by_method[method])
            units = list(equipment.speed_units.all())
            # угловая скорость — только для кольцевого шва с диаметром
            if seam.seam_type != "кольцевой":
                units = [u for u in units if not u.is_angular] or units
            unit = self.rng.choice(units) if units else None
            pulse = equipment.has_pulse and method in ("tig1", "tig2", "tig3") and self.rng.random() < 0.35

            card = WeldingCard.objects.create(
                operation=op, card_no=f"{op.part.number}-{op.number}", method_id=method, equipment=equipment,
                welding_mode="импульсный" if pulse else "непрерывный",
                tungsten=self.rng.choice(tungsten) if method in ("tig1", "tig2", "tig3", "plasma") else None,
                filler=self.rng.choice(wire) if method != "tig1" or t > 1.5 else None,
                shield_gas=argon, backing_gas=argon if method != "mig" else None,
                plasma_gas=helium if method == "plasma" else None,
                plasma_nozzle_d=Decimal("3.2") if method == "plasma" else None,
                extra={"position": "нижнее", **({"electrode_angle": "30"} if method in ("tig2", "tig3", "plasma") else {})},
                # свежие карты — черновики, остальные выпущены
                is_released=n % 5 != 0,
                author=technolog,
            )
            base = 40 + t * 22
            passes = 1 if t <= 2 else 2 if t <= 4 else 3 if t < 8 else 2
            for no in range(1, passes + 1):
                # корень на меньшем токе, заполнение — на большем
                cur = base * (0.85 if no == 1 and passes > 1 else 1.0 + 0.08 * (no - 1))
                raw = self._speed_raw(unit, seam)
                WeldPass(
                    card=card, no=no,
                    current_min=self.dec(cur * 0.92), current_max=self.dec(cur * 1.08),
                    voltage_min=self.dec(9 + t * 0.4), voltage_max=self.dec(11 + t * 0.4),
                    speed_unit=unit,
                    speed_raw_min=self.dec(raw * 0.9, 3) if unit else None,
                    speed_raw_max=self.dec(raw * 1.1, 3) if unit else None,
                    speed_required=method != "tig1",
                    wire_speed_min=self.dec(0.8 + t * 0.1, 2) if method in ("tig2", "tig3", "mig") else None,
                    wire_speed_max=self.dec(1.2 + t * 0.1, 2) if method in ("tig2", "tig3", "mig") else None,
                    gas_flow_min=Decimal("8.0"), gas_flow_max=Decimal("12.0"),
                    backing_flow_min=Decimal("3.0") if method != "mig" else None,
                    backing_flow_max=Decimal("5.0") if method != "mig" else None,
                    filler_diameter=Decimal("1.6") if method != "tig1" else None,
                    pulse_current=self.dec(cur * 1.4) if pulse else None,
                    pulse_time=Decimal("0.200") if pulse else None,
                    pause_current=self.dec(cur * 0.35) if pulse else None,
                    pause_time=Decimal("0.300") if pulse else None,
                ).save()
            self.cards.append(card)

    def _speed_raw(self, unit, seam):
        """Скорость ~8–14 м/ч в единицах установки."""
        mph = self.rng.uniform(8, 14)
        if unit is None:
            return 0
        if unit.code == "m_per_h":
            return mph
        if unit.code == "mm_per_s":
            return mph / 3.6
        if unit.code == "rpm" and seam.seam_diameter:
            return mph / (3.1416 * float(seam.seam_diameter) / 1000) / 60
        if unit.code == "deg_per_s" and seam.seam_diameter:
            return mph / (3.1416 * float(seam.seam_diameter) / 1000) / 3600 * 360
        return mph

    # ---------- производство ----------

    def _production(self, weeks):
        """Изделия идут по техпроцессу: операции по порядку, после каждой — контроль."""
        cards = {c.operation_id: c for c in self.cards}
        valid = {}
        for a in Attestation.objects.filter(status="done", valid_until__gte=self.today):
            valid.setdefault(a.method_id, []).append(a.welder)
        all_active = [w for w in self.welders if w.is_active]
        control = self.users["control"]

        parts = {}
        for op, seam in self.operations:
            parts.setdefault(op.part_id, []).append((op, seam))

        horizon = weeks * 7
        serial = 140
        for part_id, route in parts.items():
            count = self.rng.randint(3, 6)
            for k in range(count):
                # изделия запускаются равномерно; последние ещё в работе
                start_ago = horizon - int(horizon * k / count) - self.rng.randint(0, 3)
                if k == count - 1:
                    start_ago = self.rng.randint(0, 1)  # последнее изделие варится сегодня-вчера
                instance = PartInstance.objects.create(part_id=part_id, serial_no=str(serial))
                PartInstance.objects.filter(pk=instance.pk).update(created_at=self.at(max(start_ago, 0), 8, 0))
                serial += 1
                if k == 0:
                    # образец-свидетель варится вместе с первым изделием партии
                    PartInstance.objects.create(
                        part_id=part_id, serial_no=f"{instance.serial_no}-С", kind="свидетель", witness_for=instance,
                    )
                self._route(instance, route, cards, valid, all_active, control, start_ago)

    def _route(self, instance, route, cards, valid, all_active, control, start_ago):
        day = max(start_ago, 0)
        welds = {}
        for op, seam in route:
            card = cards[op.id]
            if day < 0:
                break
            weld = welds.get(seam.id)
            if weld is None:
                weld = Weld.objects.create(instance=instance, seam=seam)
                Weld.objects.filter(pk=weld.pk).update(created_at=self.at(day))
                welds[seam.id] = weld

            welder = self.rng.choice(valid.get(card.method_id) or all_active)
            started = self.at(day)
            passes = list(card.passes.all())
            in_progress = day == 0 and self.rng.random() < 0.6
            duration = timedelta(minutes=12 * len(passes) + self.rng.randint(5, 25))
            finished = None if in_progress else min(started + duration, self.now - timedelta(minutes=1))

            run = OperationRun.objects.create(
                weld=weld, operation=op, card=card, welder=welder, equipment=card.equipment,
                started_at=started, finished_at=finished, status="in_work" if in_progress else "done",
            )
            # усадку меряют не всегда — но на толстых швах обязательно
            if not in_progress and (float(seam.thickness_1) >= 6 or self.rng.random() < 0.4):
                before = self.rng.uniform(100, 400)
                run.size_before = self.dec(before, 2)
                run.size_after = self.dec(before - self.rng.uniform(0.2, 1.4) * float(seam.thickness_1) / 3, 2)
                run.measured_at = timezone.localtime(finished).date()
                run.save()

            session = WeldingSession.objects.create(
                equipment=card.equipment, welder=welder, mode="по техпроцессу",
                operation_run=run, route_code_raw=f"{instance.part.number}{op.number}{instance.serial_no}",
                started_at=started, finished_at=finished,
            )
            self._passes(run, session, passes, started, in_progress)

            if in_progress:
                break
            self._inspect(run, op, control, finished)
            day -= self.rng.choice([0, 1, 1, 2, 3])

        for weld in welds.values():
            self._weld_status(weld)

    def _passes(self, run, session, passes, started, in_progress):
        moment = started
        for plan in passes:
            if in_progress and plan.no > 1:
                break  # идёт первый проход
            arc = timedelta(minutes=self.rng.randint(3, 11), seconds=self.rng.randint(0, 59))
            pass_run = WeldPassRun.objects.create(
                run=run, no=plan.no, planned_pass=plan,
                started_at=moment, finished_at=None if in_progress else moment + arc + timedelta(minutes=2),
                arc_time=arc,
                match_source=self.rng.choice(["расчёт", "расчёт", "ток", "пауза", "датчик", "вручную"]),
            )
            lo, hi = float(plan.current_min), float(plan.current_max)
            mid = (lo + hi) / 2
            # в основном в допуске; иногда уход выше или ниже — это и увидит рабочий стол
            roll = self.rng.random()
            target = hi * self.rng.uniform(1.03, 1.12) if roll < 0.12 else \
                lo * self.rng.uniform(0.88, 0.97) if roll < 0.2 else mid * self.rng.uniform(0.97, 1.03)
            segments = self.rng.randint(1, 3)
            seg_time = arc / segments
            t = moment
            for _ in range(segments):
                avg = target * self.rng.uniform(0.98, 1.02)
                pulse = plan.pulse_current is not None
                ArcRun.objects.create(
                    session=session, pass_run=pass_run, started_at=t,
                    finished_at=None if in_progress else t + seg_time,
                    current_avg=self.dec(avg),
                    current_min=self.dec(float(plan.pause_current) if pulse else avg * 0.94),
                    current_max=self.dec(float(plan.pulse_current) if pulse else avg * 1.06),
                    voltage_avg=self.dec(float(plan.voltage_min or 10) + self.rng.uniform(0, 1.5)),
                    pulse_freq=self.dec(2.0, 2) if pulse else None,
                    telemetry_complete=not in_progress,
                )
                t += seg_time + timedelta(seconds=self.rng.randint(20, 90))
            moment = t + timedelta(minutes=2)

    def _inspect(self, run, op, control, finished):
        """Контроль приходит через 0–3 дня; свежие операции его ещё ждут."""
        age = (self.now - finished).days
        for method in op.required_controls:
            if age < 2 or (age < 5 and self.rng.random() < 0.6):
                continue  # «швы ждут контроля»
            roll = self.rng.random()
            result = "брак" if roll < 0.02 else "исправление" if roll < 0.08 else "годен"
            defects = [] if result == "годен" else [
                {"type": self.rng.choice(["пора", "непровар", "подрез", "включение"]),
                 "size": round(self.rng.uniform(0.3, 2.5), 1), "location": f"{self.rng.randint(10, 300)} мм от начала"},
            ]
            Inspection.objects.create(
                run=run, kind="окончательный" if op == op.part.operations.order_by("-order").first() else "промежуточный",
                method=method, specimen="шов", result=result, defects=defects,
                report_no=f"{method}-{self.rng.randint(1000, 9999)}",
                inspected_at=min(timezone.localtime(finished).date() + timedelta(days=self.rng.randint(0, 2)), self.today),
                inspector=control,
                conclusion="Дефектов не обнаружено." if result == "годен" else
                f"Обнаружен дефект: {defects[0]['type']} {defects[0]['size']} мм, {defects[0]['location']}.",
            )

    def _weld_status(self, weld):
        runs = list(weld.runs.prefetch_related("inspections"))
        results = [i.result for r in runs for i in r.inspections.all()]
        route_done = weld.runs.count() == weld.seam.operations.count()
        if any(r.status == "in_work" for r in runs):
            status = "in_work"
        elif "брак" in results:
            status = "rejected"
        elif route_done and results and all(x == "годен" for x in results) and \
                all(not r.operation.required_controls or r.inspections.exists() for r in runs):
            status = "accepted"
        elif route_done:
            status = "done"
        else:
            status = "in_work"
        Weld.objects.filter(pk=weld.pk).update(status=status)

    def _loose_sessions(self):
        """Сварка без шва: отработка режимов и прихватка. И пара сеансов «прямо сейчас»."""
        for _ in range(9):
            eq = self.rng.choice(list(Equipment.objects.all()))
            started = self.at(self.rng.randint(0, 20))
            session = WeldingSession.objects.create(
                equipment=eq, welder=self.rng.choice(self.welders[:-1]),
                mode=self.rng.choice(["отработка", "прихватка"]),
                started_at=started, finished_at=started + timedelta(minutes=self.rng.randint(5, 40)),
            )
            ArcRun.objects.create(
                session=session, started_at=started, finished_at=started + timedelta(minutes=2),
                current_avg=self.dec(self.rng.uniform(60, 160)), telemetry_complete=True,
            )
        # открытые сеансы — «идёт сварка» на рабочем столе
        for eq_id in (1, 7):
            started = self.now - timedelta(minutes=self.rng.randint(5, 40))
            session = WeldingSession.objects.create(
                equipment_id=eq_id, welder=self.rng.choice(self.welders[:-1]), mode="отработка", started_at=started,
            )
            ArcRun.objects.create(session=session, started_at=started, current_avg=self.dec(self.rng.uniform(80, 140)))

    # ---------- заявки ----------

    def _service(self):
        equipment = list(Equipment.objects.all())
        masters = [self.users["master"], self.users["master7"]]
        mechanic = self.users["mechanic"]
        for i, (reason, priority, text) in enumerate(SERVICE):
            days_ago = [0, 0, 1, 2, 3, 5, 8, 11, 15, 19, 24, 30, 37, 45][i]
            created = self.at(days_ago)
            # свежие — открыты или в работе, старые — закрыты
            status = "open" if days_ago <= 1 else "in_work" if days_ago <= 3 else \
                "rejected" if i in (8, 12) else "done"
            request = ServiceRequest.objects.create(
                equipment=self.rng.choice(equipment), reason=reason, priority=priority,
                description=text, status=status, author=self.rng.choice(masters),
            )
            update = {"created_at": created}
            if status in ("done", "rejected"):
                update.update(
                    closed_by=mechanic, closed_by_name=mechanic.name,
                    closed_at=created + timedelta(hours=self.rng.randint(2, 50)),
                    resolution=self.rng.choice(REJECTIONS if status == "rejected" else RESOLUTIONS),
                )
            ServiceRequest.objects.filter(pk=request.pk).update(**update)
