# СВАРЕННЫЕ ШВЫ, ВЫПОЛНЕНИЕ, ФАКТ, КОНТРОЛЬ

# Слой «КАК БЫЛО» — производство и прослеживаемость.
#
#   PartInstance          изделие с заводским номером
#     └── Weld            сваренный шов = изделие + шов по чертежу
#           └── OperationRun    выполнение операции: карта, сварщик, аппарат
#                 ├── WeldPassRun   проход по факту
#                 └── Inspection    заключение контроля
#
# Отдельно, потому что сварка бывает и без шва:
#
#   WeldingSession        сеанс сварки: аппарат + сварщик + время + режим
#     └── ArcRun          участок непрерывного горения дуги
#           └── телеметрия (в ClickHouse, сюда не кладётся)
#
# Сессия цепляется к аппарату и сварщику, а НЕ к шву. Отработка режимов
# и прихватка оснастки — это сварка, которой никакого шва по чертежу
# не соответствует. Если бы корнем был шов, такие записи было бы некуда
# деть, и их начали бы привязывать куда попало.

from django.db import models


class PartInstance(models.Model):
    """Конкретное изделие: деталь по чертежу + заводской номер.

    Учёт поштучный, поэтому уровня партии нет.
    """

    class Kind(models.TextChoices):
        PRODUCTION = "штатное", "Штатное изделие"
        WITNESS = "свидетель", "Образец-свидетель"

    part = models.ForeignKey(
        "technology.Part", on_delete=models.PROTECT,
        related_name="instances", verbose_name="Деталь",
    )
    serial_no = models.CharField("Заводской номер", max_length=100)

    # образец-свидетель варится по той же технологии, что штатное изделие:
    # те же операции, те же карты. Отличается только признаком и ссылкой
    kind = models.CharField(
        "Вид", max_length=20, choices=Kind.choices, default=Kind.PRODUCTION,
    )
    witness_for = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="witnesses", verbose_name="Свидетель к изделию",
    )

    created_at = models.DateTimeField("Заведено", auto_now_add=True)

    class Meta:
        verbose_name = "Изделие"
        verbose_name_plural = "Изделия"
        ordering = ["-created_at"]
        unique_together = ["part", "serial_no"]
        indexes = [models.Index(fields=["kind"])]

    def __str__(self):
        return f"{self.part.number} № {self.serial_no}"


class Weld(models.Model):
    """Сваренный шов — якорь прослеживаемости.

    Пересечение изделия и шва по чертежу: «шов №3 на корпусе № 147».
    Создаётся по факту первой операции, заранее планировать не нужно.
    """

    class Status(models.TextChoices):
        IN_WORK = "in_work", "В работе"
        DONE = "done", "Сварен"
        ACCEPTED = "accepted", "Принят"
        REJECTED = "rejected", "Забракован"

    instance = models.ForeignKey(
        PartInstance, on_delete=models.CASCADE,
        related_name="welds", verbose_name="Изделие",
    )
    seam = models.ForeignKey(
        "technology.SeamSpec", on_delete=models.PROTECT,
        related_name="welds", verbose_name="Шов по чертежу",
    )

    status = models.CharField(
        "Статус", max_length=20, choices=Status.choices, default=Status.IN_WORK,
    )
    created_at = models.DateTimeField("Заведён", auto_now_add=True)

    class Meta:
        verbose_name = "Сварной шов"
        verbose_name_plural = "Сварные швы"
        ordering = ["-created_at"]
        # один шов по чертежу на одном изделии существует в одном экземпляре
        unique_together = ["instance", "seam"]
        indexes = [models.Index(fields=["status"])]

    def __str__(self):
        return f"{self.instance} · шов {self.seam.number}"


class OperationRun(models.Model):
    """Выполнение операции на конкретном шве."""

    class Status(models.TextChoices):
        IN_WORK = "in_work", "В работе"
        DONE = "done", "Выполнена"

    weld = models.ForeignKey(
        Weld, on_delete=models.CASCADE, related_name="runs", verbose_name="Шов",
    )
    operation = models.ForeignKey(
        "technology.Operation", on_delete=models.PROTECT,
        related_name="runs", verbose_name="Операция",
    )
    # PROTECT: карту, по которой варили, удалить нельзя — иначе потеряется
    # план, с которым сверяется факт. Ссылка историческая: карту могут
    # переиздать, а прослеживаемость должна помнить ту, по которой работали
    card = models.ForeignKey(
        "weldingcards.WeldingCard", on_delete=models.PROTECT,
        related_name="runs", verbose_name="Техкарта",
    )

    welder = models.ForeignKey(
        "welders.Welder", on_delete=models.PROTECT, null=True, blank=True,
        related_name="runs", verbose_name="Сварщик",
    )
    equipment = models.ForeignKey(
        "equipment.Equipment", on_delete=models.PROTECT, null=True, blank=True,
        related_name="runs", verbose_name="Оборудование",
    )

    started_at = models.DateTimeField("Начата", null=True, blank=True)
    finished_at = models.DateTimeField("Закончена", null=True, blank=True)
    status = models.CharField(
        "Статус", max_length=20, choices=Status.choices, default=Status.IN_WORK,
    )

    # --- замеры усадки: делаются после операции, а не в конце всей сварки ---
    size_before = models.DecimalField(
        "Размер до сварки, мм", max_digits=10, decimal_places=2,
        null=True, blank=True,
    )
    size_after = models.DecimalField(
        "Размер после сварки, мм", max_digits=10, decimal_places=2,
        null=True, blank=True,
    )
    measured_at = models.DateField("Дата замера", null=True, blank=True)

    note = models.TextField("Примечание", blank=True)

    class Meta:
        verbose_name = "Выполнение операции"
        verbose_name_plural = "Выполнение операций"
        ordering = ["weld", "operation"]
        unique_together = ["weld", "operation"]
        indexes = [
            models.Index(fields=["card"]),
            models.Index(fields=["welder", "started_at"]),
            models.Index(fields=["equipment", "started_at"]),
        ]

    @property
    def shrinkage(self):
        """Усадка, мм. None, если замеры не внесены."""
        if self.size_before is None or self.size_after is None:
            return None
        return self.size_before - self.size_after

    def __str__(self):
        return f"{self.weld} · оп. {self.operation.number}"


class WeldPassRun(models.Model):
    """Проход по факту.

    Границы проходов система определяет расчётом: накопленное время
    горения дуги сравнивается с расчётным по длине шва и скорости
    из карты. Надёжного признака границы нет — деталь может не
    останавливаться между проходами, и ток может не меняться.
    Поэтому у сопоставления есть уровень достоверности.
    """

    class MatchSource(models.TextChoices):
        MANUAL = "вручную", "Указано человеком"
        SENSOR = "датчик", "По датчику вращения"
        CURRENT = "ток", "Подтверждено скачком тока"
        PAUSE = "пауза", "Подтверждено остановкой"
        CALCULATED = "расчёт", "Только по накопленному времени дуги"

    run = models.ForeignKey(
        OperationRun, on_delete=models.CASCADE,
        related_name="passes", verbose_name="Выполнение операции",
    )
    no = models.PositiveSmallIntegerField("№ прохода")

    # план этого прохода. SET_NULL: карту могут отредактировать,
    # а запись о том, что проход варили, должна пережить правку плана
    planned_pass = models.ForeignKey(
        "weldingcards.WeldPass", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="runs", verbose_name="Проход по карте",
    )

    started_at = models.DateTimeField("Начат", null=True, blank=True)
    finished_at = models.DateTimeField("Закончен", null=True, blank=True)
    arc_time = models.DurationField(
        "Чистое время горения дуги", null=True, blank=True,
        help_text="Сумма сегментов дуги без пауз — по нему считается "
                  "фактическая скорость",
    )

    match_source = models.CharField(
        "Как определена граница прохода", max_length=20,
        choices=MatchSource.choices, default=MatchSource.CALCULATED,
    )

    class Meta:
        verbose_name = "Проход (факт)"
        verbose_name_plural = "Проходы (факт)"
        ordering = ["run", "no"]
        unique_together = ["run", "no"]
        indexes = [models.Index(fields=["started_at", "finished_at"])]

    def __str__(self):
        return f"{self.run} · проход {self.no}"


class WeldingSession(models.Model):
    """Сеанс сварки на аппарате — корень телеметрии.

    Существует независимо от шва: отработка режимов и прихватка
    оснастки — это сварка, которой шва по чертежу не соответствует.
    Ограничение на такую работу должно быть организационным (много
    отработок — вопрос к мастеру), а не техническим: если система
    не даст варить при затёртом QR, её обойдут в первую же неделю.
    """

    class Mode(models.TextChoices):
        ROUTINE = "по техпроцессу", "По техпроцессу"
        TRIAL = "отработка", "Отработка режимов"
        TACK = "прихватка", "Прихватка и вспомогательные работы"

    equipment = models.ForeignKey(
        "equipment.Equipment", on_delete=models.PROTECT,
        related_name="sessions", verbose_name="Оборудование",
    )
    welder = models.ForeignKey(
        "welders.Welder", on_delete=models.PROTECT, null=True, blank=True,
        related_name="sessions", verbose_name="Сварщик",
    )
    welder_name = models.CharField("Сварщик (снимок)", max_length=200, blank=True)

    mode = models.CharField(
        "Режим записи", max_length=20, choices=Mode.choices, default=Mode.ROUTINE,
    )

    external_id = models.CharField(
        "Идентификатор сеанса от узла", max_length=100, unique=True, null=True, blank=True,
        help_text="Генерирует узел: <node>-<время старта>. "
                  "Нужен, чтобы узел мог работать без связи с порталом",
    )

    # заполняется только в режиме «по техпроцессу».
    # SET_NULL: если QR прочитан, а расшифровки ещё нет, данные
    # не теряются — портал привяжет их позже
    operation_run = models.ForeignKey(
        OperationRun, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="sessions", verbose_name="Выполнение операции",
    )

    # сырое содержимое QR, как его прочитал узел. Формат задаёт MES
    # и он может меняться, поэтому просто строка без проверок длины.
    # Хранится даже когда расшифровка удалась: при смене формата
    # или ошибке разбора можно переразобрать задним числом
    route_code_raw = models.CharField(
        "Код с маршрутного листа", max_length=50, blank=True,
    )

    started_at = models.DateTimeField("Начата")
    finished_at = models.DateTimeField("Закончена", null=True, blank=True)

    class Meta:
        verbose_name = "Сеанс сварки"
        verbose_name_plural = "Сеансы сварки"
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["equipment", "started_at"]),
            models.Index(fields=["welder", "started_at"]),
            models.Index(fields=["mode"]),
        ]

    def save(self, *args, **kwargs):
        if self.welder and not self.welder_name:
            self.welder_name = self.welder.fio
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.equipment} · {self.started_at:%d.%m %H:%M} · {self.mode}"


class ArcRun(models.Model):
    """Участок непрерывного горения дуги — атомарная запись телеметрии.

    Узел создаёт его сам по появлению и пропаданию тока (порог 5 А).
    Внутри одного прохода сегментов может быть несколько: перехват,
    обрыв, технологическая остановка. Поэтому сегмент и проход —
    разные вещи, и связь между ними необязательная.
    """

    session = models.ForeignKey(
        WeldingSession, on_delete=models.CASCADE,
        related_name="arcs", verbose_name="Сеанс",
    )
    pass_run = models.ForeignKey(
        WeldPassRun, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="arcs", verbose_name="Проход",
    )

    started_at = models.DateTimeField("Начало дуги")
    finished_at = models.DateTimeField("Конец дуги", null=True, blank=True)

    # сводка по сегменту. Сварка идёт импульсом, поэтому одно усреднённое
    # значение бессмысленно: максимум — ток импульса, минимум — ток
    # дежурной дуги, среднее — интегральный ток для тепловложения.
    # Сравнивать с картой надо соответственно: среднее с диапазоном
    # current_min/max, максимум с pulse_current, минимум с pause_current
    current_avg = models.DecimalField(
        "Ток средний, А", max_digits=7, decimal_places=1, null=True, blank=True,
    )
    current_min = models.DecimalField(
        "Ток минимальный, А", max_digits=7, decimal_places=1, null=True, blank=True,
    )
    current_max = models.DecimalField(
        "Ток максимальный, А", max_digits=7, decimal_places=1, null=True, blank=True,
    )
    voltage_avg = models.DecimalField(
        "Напряжение среднее, В", max_digits=6, decimal_places=1, null=True, blank=True,
    )
    pulse_freq = models.DecimalField(
        "Частота импульсов, Гц", max_digits=7, decimal_places=2, null=True, blank=True,
    )

    # признак, что полная телеметрия по сегменту доехала до хранилища
    telemetry_complete = models.BooleanField(
        "Телеметрия получена полностью", default=False,
        help_text="Узел шлёт запись порциями; при обрыве сети они ждут "
                  "на узле и досылаются позже",
    )

    class Meta:
        verbose_name = "Участок дуги"
        verbose_name_plural = "Участки дуги"
        ordering = ["session", "started_at"]
        indexes = [
            models.Index(fields=["session", "started_at"]),
            models.Index(fields=["pass_run"]),
        ]

    @property
    def duration(self):
        if self.started_at and self.finished_at:
            return self.finished_at - self.started_at
        return None

    def __str__(self):
        return f"Дуга {self.started_at:%H:%M:%S} ({self.session_id})"


class Inspection(models.Model):
    """Заключение контроля. Цепляется к ВЫПОЛНЕНИЮ ОПЕРАЦИИ, а не к шву.

    У шва 13 мм два заключения: промежуточное после первой операции
    и окончательное после второй. Если вешать на шов, они становятся
    неразличимы, и непонятно, после каких проходов возник дефект.
    """

    class Kind(models.TextChoices):
        INTERMEDIATE = "промежуточный", "Промежуточный"
        FINAL = "окончательный", "Окончательный"

    class Method(models.TextChoices):
        RT = "РК", "Радиографический"
        VT = "ВИК", "Визуально-измерительный"
        UT = "УЗК", "Ультразвуковой"
        PT = "ПВК", "Капиллярный"
        MT = "МК", "Металлографический"

    class Specimen(models.TextChoices):
        SEAM = "шов", "Сам шов"
        WITNESS = "свидетель", "Образец-свидетель"
        CUTOUT = "вырезка", "Вырезка из шва"

    class Result(models.TextChoices):
        PASS = "годен", "Годен"
        REWORK = "исправление", "Требует исправления"
        FAIL = "брак", "Брак"

    run = models.ForeignKey(
        OperationRun, on_delete=models.PROTECT,
        related_name="inspections", verbose_name="Выполнение операции",
    )
    kind = models.CharField("Вид контроля", max_length=20, choices=Kind.choices)
    method = models.CharField("Метод", max_length=10, choices=Method.choices)

    # на чём проводили. Важно для статистики: результаты по шву
    # и свидетелю идут в обучающую выборку, вырезки — нет: их делают
    # только из брака, и выборка окажется смещённой
    specimen = models.CharField(
        "Объект контроля", max_length=20,
        choices=Specimen.choices, default=Specimen.SEAM,
    )

    result = models.CharField("Результат", max_length=20, choices=Result.choices)
    # [{"type": "пора", "size": 1.2, "location": "..."}]
    # JSON, потому что набор полей у разных типов дефектов разный,
    # а классификатор дефектов пока не заведён
    defects = models.JSONField("Дефекты", default=list, blank=True)

    report_no = models.CharField("№ заключения", max_length=50, blank=True)
    inspected_at = models.DateField("Дата контроля", null=True, blank=True)
    inspector = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="inspections", verbose_name="Контролёр",
    )
    inspector_name = models.CharField("Контролёр (снимок)", max_length=200, blank=True)
    conclusion = models.TextField("Заключение", blank=True)

    class Meta:
        verbose_name = "Заключение контроля"
        verbose_name_plural = "Заключения контроля"
        ordering = ["-inspected_at"]
        indexes = [
            models.Index(fields=["result"]),
            models.Index(fields=["method", "result"]),
            models.Index(fields=["specimen"]),
        ]

    def save(self, *args, **kwargs):
        # снимок фамилии: контролёр уволится, учётку удалят,
        # а в заключении должно остаться, кто подписал
        if self.inspector and not self.inspector_name:
            self.inspector_name = self.inspector.name
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.method} · {self.run} · {self.result}"

class RouteCode(models.Model):
    """Соответствие «код с маршрутного листа → что варим».

    Портал смотрит в свою таблицу, а не в MES напрямую: наполняться
    она может как угодно — руками, выгрузкой, через API, — и способ
    наполнения меняется без переписывания портала.

    Формат кода задаёт MES и он может меняться, поэтому просто строка
    без проверок длины.
    """

    code = models.CharField(
        "Код операции по маршруту", max_length=50, unique=True,
    )
    part = models.ForeignKey(
        "technology.Part", on_delete=models.PROTECT,
        related_name="route_codes", verbose_name="Деталь",
    )
    operation = models.ForeignKey(
        "technology.Operation", on_delete=models.PROTECT,
        related_name="route_codes", verbose_name="Операция",
    )
    # экземпляр может быть неизвестен в момент заведения кода
    instance = models.ForeignKey(
        PartInstance, on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="route_codes", verbose_name="Изделие",
    )
    source = models.CharField(
        "Откуда получено", max_length=50, blank=True,
        help_text="вручную / выгрузка / API MES",
    )
    created_at = models.DateTimeField("Заведено", auto_now_add=True)

    class Meta:
        verbose_name = "Код маршрутного листа"
        verbose_name_plural = "Коды маршрутных листов"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} → {self.operation}"


# телеметрия и контроль режима
#
# Узел меряет ТОЛЬКО ток и напряжение. Всё остальное считается из них:
#   время горения дуги   — по порогу тока (5 А)
#   остановки            — промежутки между участками дуги
#   скорость             — длина шва / время дуги
#   расход газа и проволоки — время × норма из карты (ОЦЕНКА, не измерение)
#
# Поэтому прямо контролируются ток и напряжение, косвенно скорость,
# а расход и межслойная температура — только расчётом и по времени пауз.

class WeldStop(models.Model):
    """Остановка внутри операции: дуга погасла и снова зажглась.

    Создаётся порталом при разборе потока: промежуток между соседними
    ArcRun длиннее порога считается остановкой. Короткие разрывы
    (перехват, смена положения) — рабочие, длинные означают,
    что шов успел остыть.
    """

    class Kind(models.TextChoices):
        SHORT = "рабочая", "Рабочая пауза"
        INTERPASS = "межслойная", "Между проходами"
        LONG = "длительная", "Длительная остановка"

    run = models.ForeignKey(
        "OperationRun", on_delete=models.CASCADE,
        related_name="stops", verbose_name="Выполнение операции",
    )
    # между какими участками дуги возникла пауза
    after_arc = models.ForeignKey(
        "ArcRun", on_delete=models.CASCADE,
        related_name="stop_after", verbose_name="После участка дуги",
    )

    started_at = models.DateTimeField("Начало паузы")
    finished_at = models.DateTimeField("Конец паузы", null=True, blank=True)
    duration = models.DurationField("Длительность", null=True, blank=True)

    kind = models.CharField(
        "Тип", max_length=20, choices=Kind.choices, default=Kind.SHORT,
    )
    # межслойная температура нормирована в карте, но датчика нет.
    # Косвенный признак: слишком долгая пауза — переохлаждение,
    # слишком короткая — перегрев. Отмечаем для технолога
    is_suspicious = models.BooleanField(
        "Требует внимания", default=False,
        help_text="Пауза выбивается из обычной для этого способа",
    )
    note = models.CharField("Примечание", max_length=200, blank=True)

    class Meta:
        verbose_name = "Остановка"
        verbose_name_plural = "Остановки"
        ordering = ["run", "started_at"]
        indexes = [models.Index(fields=["run", "started_at"])]

    def __str__(self):
        return f"Пауза {self.duration} ({self.run_id})"


class Deviation(models.Model):
    """Зафиксированное отклонение от режима карты.

    Хранится, а не считается на лету: нарушение — это факт, который
    нужен в прослеживаемости. Пересчёт по изменившейся карте не должен
    задним числом стирать то, что уже произошло.
    """

    class Parameter(models.TextChoices):
        CURRENT = "ток", "Ток сварки"
        VOLTAGE = "напряжение", "Напряжение дуги"
        SPEED = "скорость", "Скорость сварки"
        PULSE_CURRENT = "ток_импульса", "Ток импульса"
        PAUSE_CURRENT = "ток_паузы", "Ток паузы"
        INTERPASS = "межслойная", "Межслойная пауза"
        NO_CARD = "без_карты", "Сварка без техкарты"
        NO_ATTESTATION = "без_допуска", "Сварщик без действующего допуска"

    

    class Severity(models.TextChoices):
        INFO = "замечание", "Замечание"
        WARNING = "предупреждение", "Предупреждение"
        CRITICAL = "нарушение", "Нарушение"

    ORGANIZATIONAL = {Parameter.NO_CARD, Parameter.NO_ATTESTATION}

    session = models.ForeignKey(
        "WeldingSession", on_delete=models.CASCADE,
        related_name="deviations", verbose_name="Сеанс",
    )
    pass_run = models.ForeignKey(
        "WeldPassRun", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="deviations", verbose_name="Проход",
    )

    parameter = models.CharField(
        "Параметр", max_length=20, choices=Parameter.choices,
    )
    severity = models.CharField(
        "Уровень", max_length=20, choices=Severity.choices,
        default=Severity.WARNING,
    )

    # что было по карте и что вышло по факту
    planned_min = models.DecimalField(
        "По карте от", max_digits=10, decimal_places=2, null=True, blank=True,
    )
    planned_max = models.DecimalField(
        "По карте до", max_digits=10, decimal_places=2, null=True, blank=True,
    )
    actual_value = models.DecimalField(
        "Фактически", max_digits=10, decimal_places=2, null=True, blank=True,
    )
    deviation_percent = models.DecimalField(
        "Отклонение, %", max_digits=6, decimal_places=1, null=True, blank=True,
    )

    started_at = models.DateTimeField("Начало отклонения")
    finished_at = models.DateTimeField("Конец отклонения", null=True, blank=True)
    duration = models.DurationField(
        "Длительность", null=True, blank=True,
        help_text="Короткий выброс и устойчивый выход за допуск — разные вещи",
    )

    # технолог может признать отклонение несущественным
    reviewed = models.BooleanField("Рассмотрено", default=False)

    class Meta:
        verbose_name = "Отклонение от режима"
        verbose_name_plural = "Отклонения от режима"
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["session", "parameter"]),
            models.Index(fields=["severity", "reviewed"]),
        ]

    @property
    def is_organizational(self) -> bool:
        return self.parameter in self.ORGANIZATIONAL
    
    def __str__(self):
        return f"{self.get_parameter_display()}: {self.actual_value} ({self.severity})"


class ConsumptionEstimate(models.Model):
    """Расчётный расход материалов за операцию.

    ВАЖНО: это ОЦЕНКА, а не измерение. Считается как время горения дуги
    умноженное на норму из техкарты. Если газ не подали или редуктор сбит,
    расчёт этого не покажет — расходомера в узле нет.

    Проволока считается только для механизированных способов с подачей.
    На ручной аргонодуговой присадку кладут рукой, и расчёт по времени
    смысла не имеет — поле остаётся пустым.
    """

    run = models.OneToOneField(
        "OperationRun", on_delete=models.CASCADE,
        related_name="consumption", verbose_name="Выполнение операции",
    )

    arc_time_total = models.DurationField(
        "Суммарное время горения дуги", null=True, blank=True,
    )

    gas_shield = models.DecimalField(
        "Защитный газ, л", max_digits=9, decimal_places=2, null=True, blank=True,
    )
    gas_backing = models.DecimalField(
        "Газ на поддув, л", max_digits=9, decimal_places=2, null=True, blank=True,
    )
    gas_plasma = models.DecimalField(
        "Плазмообразующий газ, л", max_digits=9, decimal_places=2,
        null=True, blank=True,
    )
    wire_length = models.DecimalField(
        "Проволока, м", max_digits=9, decimal_places=2, null=True, blank=True,
        help_text="Только для механизированных способов с подачей",
    )

    calculated_at = models.DateTimeField("Рассчитано", auto_now=True)

    class Meta:
        verbose_name = "Расчётный расход"
        verbose_name_plural = "Расчётный расход"

    def __str__(self):
        return f"Расход по операции {self.run_id}"    

# Состояние узлов телеметрии: кто на связи, кто молчит и когда молчал.
#
# Узел не умеет сообщить «я выключился» — на то он и выключился.
# Поэтому пропажу замечает портал: если узел давно не писал,
# значит связи нет. Эти две таблицы и хранят такие наблюдения.

class NodeState(models.Model):
    """Текущее состояние узла. Одна строка на узел, перезаписывается.

    Отдельно от Equipment намеренно: оборудование — это справочник,
    он меняется раз в год, а эта строка обновляется каждые пару секунд.
    Мешать их — значит дёргать справочник непрерывными записями.
    """

    # Идентификатор из темы MQTT: weld/<node_id>/...
    node_id = models.CharField("узел", max_length=64, unique=True)

    # Узел может появиться в сети раньше, чем его внесут в справочник,
    # поэтому связь необязательная: строку создадим всё равно,
    # а на панели покажем «узел не привязан к оборудованию»
    equipment = models.ForeignKey(
        "equipment.Equipment",
        verbose_name="оборудование",
        on_delete=models.SET_NULL,
        related_name="node_states",
        null=True,
        blank=True,
    )

    # Любое сообщение от узла обновляет это поле. Именно по нему
    # решается, на связи он или нет
    last_seen_at = models.DateTimeField("последнее сообщение", null=True, blank=True)
    # Отдельно — последний status: он приходит по расписанию,
    # а остальные сообщения только во время сварки
    last_status_at = models.DateTimeField("последний status", null=True, blank=True)

    is_online = models.BooleanField("на связи", default=False)

    # Сколько порций замеров узел не смог отправить и держит у себя.
    # Больше нуля означает, что связь была, данные догоняют
    queued = models.PositiveIntegerField("ждёт выгрузки, порций", default=0)

    # Диагностика — то, что узел сообщает о себе сам
    ip = models.GenericIPAddressField("адрес", null=True, blank=True)
    firmware = models.CharField("версия прошивки", max_length=40, blank=True)
    uptime_seconds = models.PositiveIntegerField("наработка, с", null=True, blank=True)
    free_bytes = models.PositiveBigIntegerField("свободно, байт", null=True, blank=True)
    temperature = models.DecimalField(
        "температура, °C", max_digits=5, decimal_places=1, null=True, blank=True
    )

    # Причина последнего пуска: по питанию, по сбросу, по сторожевому
    # таймеру. Нужна, чтобы отличить «выдернули кабель питания»
    # от «прошивка повисла и перезапустилась сама»
    reset_reason = models.CharField("причина пуска", max_length=40, blank=True)

    class Meta:
        verbose_name = "состояние узла"
        verbose_name_plural = "состояние узлов"
        ordering = ["node_id"]

    def __str__(self):
        where = self.equipment.name if self.equipment else "без привязки"
        return f"{self.node_id} ({where})"


class NodeOutage(models.Model):
    """Период, когда узел был не на связи.

    Одна строка на обрыв, а не на каждую секунду молчания.
    Пока связи нет, finished_at пустой — это открытый обрыв.

    Зачем вообще хранить: время без связи нельзя записать ни в работу,
    ни в простой. Мы не знаем, что происходило. При расчёте Кз оно
    вычитается из фонда отдельной категорией «нет данных», иначе
    коэффициент окажется заниженным без всякой вины цеха.
    """

    node = models.ForeignKey(
        NodeState,
        verbose_name="узел",
        on_delete=models.CASCADE,
        related_name="outages",
    )

    started_at = models.DateTimeField("с")
    finished_at = models.DateTimeField("по", null=True, blank=True)

    # Что мы поняли про причину. Узел, вернувшись, сообщает причину
    # пуска, и по ней обрыв дополняется задним числом
    KINDS = [
        ("нет связи", "нет связи"),
        ("без питания", "узел был без питания"),
        ("перезапуск", "узел перезапустился"),
    ]
    kind = models.CharField("вид", max_length=20, choices=KINDS, default="нет связи")

    class Meta:
        verbose_name = "пропадание связи"
        verbose_name_plural = "пропадания связи"
        ordering = ["-started_at"]
        indexes = [
            # Запрос «обрывы за период» — основной, по нему и индекс
            models.Index(fields=["node", "started_at"]),
        ]

    def __str__(self):
        end = f"{self.finished_at:%d.%m %H:%M}" if self.finished_at else "идёт"
        return f"{self.node.node_id}: {self.started_at:%d.%m %H:%M} — {end}"

    @property
    def duration_seconds(self) -> int | None:
        """Сколько длился обрыв. None, если ещё идёт."""
        if self.finished_at is None:
            return None
        return int((self.finished_at - self.started_at).total_seconds())    

class WeldDecision(models.Model):
    """Решение по отклонениям от режима или нарушениям порядка."""
 
    class Result(models.TextChoices):
        ALLOWED = "допущено", "Допущено без мероприятий"
        TO_CONTROL = "на контроль", "Назначен дополнительный контроль"
        TO_REWORK = "на переварку", "Выборка и переварка"
        # Для организационных нарушений: сварка без карты, сварщик
        # без действующего допуска. Их не допускают и не переваривают —
        # их разбирают с мастером. Но отметить, что случай не забыт,
        # нужно, иначе очередь копится и на неё перестают смотреть
        HANDLED = "разобрано", "Разобрано, мероприятия приняты"
 
    # Сеанс есть ВСЕГДА — это корень телеметрии. Шва может не быть:
    # при сварке без карты узел записал процесс, а к какой детали
    # он относится, неизвестно. Поэтому обязательна связь с сеансом,
    # а не со швом
    session = models.ForeignKey(
        "WeldingSession", on_delete=models.CASCADE,
        related_name="decisions", verbose_name="Сеанс",
    )
 
    # Шов — когда понятно, к чему относится. Для организационных
    # нарушений обычно пусто
    weld = models.ForeignKey(
        "Weld", on_delete=models.CASCADE, null=True, blank=True,
        related_name="decisions", verbose_name="Шов",
    )
    # Операция — когда решение касается только её. Переварить корень
    # можно, лишь пока его не заварили сверху, поэтому по корню решают
    # отдельно и сразу. А «назначить РК» относится к шву целиком
    # и имеет смысл только после всех операций
    run = models.ForeignKey(
        "OperationRun", on_delete=models.CASCADE, null=True, blank=True,
        related_name="decisions", verbose_name="Операция",
    )
 
    result = models.CharField(
        "Решение", max_length=20, choices=Result.choices,
    )
 
    # Какие именно отклонения закрыты. Многие-ко-многим, потому что
    # одно решение обычно накрывает несколько просадок подряд:
    # технолог смотрит на шов, а не на каждую секунду по отдельности
    deviations = models.ManyToManyField(
        "Deviation", related_name="decisions", blank=True,
        verbose_name="Отклонения",
    )
 
    # PROTECT: пользователя с решениями удалить нельзя.
    # Подпись под решением должна читаться годы спустя
    author = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT,
        related_name="weld_decisions", verbose_name="Принял",
    )
    author_name = models.CharField("Принял (снимок)", max_length=200, blank=True)
    created_at = models.DateTimeField("Когда", auto_now_add=True)
 
    # Обоснование. Свободный текст: утверждённой формы допуска
    # отклонения на предприятии нет, и заводить справочник раньше,
    # чем появится практика, бессмысленно
    reason = models.TextField("Обоснование", blank=True)
 
    # Что назначено при решении «на контроль». Пока строка; позже
    # свяжется с заявкой в лабораторию
    assigned_control = models.CharField(
        "Назначенный контроль", max_length=100, blank=True,
        help_text="РК, УЗК, ВИК — через запятую",
    )
 
    class Meta:
        verbose_name = "Решение по отклонению"
        verbose_name_plural = "Решения по отклонениям"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["session", "-created_at"]),
            models.Index(fields=["weld", "-created_at"]),
            models.Index(fields=["result"]),
        ]
 
    def save(self, *args, **kwargs):
        # снимок подписи делается один раз, при создании, и больше
        # не трогается: человек может уволиться или сменить фамилию,
        # а под решением должна остаться та, что была тогда
        if self.author_id and not self.author_name:
            self.author_name = self.author.name
        super().save(*args, **kwargs)
 
    def __str__(self):
        where = self.weld or self.session
        return f"{where}: {self.result}"
         