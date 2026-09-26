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