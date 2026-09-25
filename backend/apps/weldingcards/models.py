# ТЕХКАРТЫ, ПРОХОДЫ

# Техкарта — документ ОДНОЙ операции. Описывает РЕЖИМ: способ,
# оборудование, сварочные материалы, разделку, проходы.
#
# Что карта больше НЕ хранит и куда это уехало:
#
#   detail_no, detail, oper, seam   → связь operation (technology.Operation)
#                                     деталь, номер операции и шов достаются
#                                     по цепочке, дублировать текстом незачем
#
#   material_1/2, thickness_1/2     → technology.SeamSpec
#   pos_1/2, mass_1/2               свойства стыка, а не режима: карта может
#   seam_type, seam_diameter,       применяться только к своему шву, и он
#   seam_length                     сам знает, из чего и какой толщины
#
#   size_before, size_after,        → welding.OperationRun
#   measured_at                     это ЗАМЕР конкретного изделия. Карта —
#                                   шаблон на серию, усадка у каждого
#                                   экземпляра своя
#
# Цепочка поиска карты порталом:
#   деталь + номер операции → Operation → card → seam → материалы, толщина

from django.db import models


class WeldingCard(models.Model):
    """Технологическая карта сварки на одну операцию."""

    class WeldingMode(models.TextChoices):
        CONTINUOUS = "непрерывный", "Непрерывный"
        PULSE = "импульсный", "Импульсный"

    # ---------- к чему относится ----------
    # OneToOne: одна операция — одна карта. Вторую база не пустит
    operation = models.OneToOneField(
        "technology.Operation",
        on_delete=models.PROTECT,
        related_name="card",
        verbose_name="Операция",
    )
    card_no = models.CharField("№ карты", max_length=50)
    revision = models.PositiveSmallIntegerField(
        "Редакция", default=1,
        help_text="Растёт при переиздании карты. Прослеживаемость хранит "
                  "ссылку на ту карту, по которой реально варили",
    )

    # ---------- технология ----------
    method = models.ForeignKey(
        "methods.WeldingMethod",
        on_delete=models.PROTECT,
        related_name="cards",
        verbose_name="Способ сварки",
    )
    equipment = models.ForeignKey(
        "equipment.Equipment",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cards",
        verbose_name="Оборудование",
    )
    welding_mode = models.CharField(
        "Режим сварки",
        max_length=20,
        choices=WeldingMode.choices,
        default=WeldingMode.CONTINUOUS,
        blank=True,
    )

    # ---------- сварочные материалы и среда ----------
    # схема «FK + текстовый снимок»: FK для аналитики, текст для документа.
    # Снимок заполняется один раз и не меняется вслед за справочником —
    # иначе выпущенный документ поедет задним числом
    tungsten = models.ForeignKey(
        "materials.FillerMaterial",
        on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
        limit_choices_to={"kind": "вольфрам"},
        verbose_name="Вольфрамовый электрод",
    )
    tungsten_text = models.CharField(
        "Вольфрамовый электрод (снимок)", max_length=100, blank=True
    )

    filler = models.ForeignKey(
        "materials.FillerMaterial",
        on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
        verbose_name="Присадочный материал",
    )
    filler_text = models.CharField(
        "Присадочный материал (снимок)", max_length=100, blank=True
    )

    shield_gas = models.ForeignKey(
        "materials.GasFlux",
        on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
        limit_choices_to={"kind": "gas"},
        verbose_name="Защитный газ в горелку",
    )
    shield_gas_text = models.CharField("Защитный газ (снимок)", max_length=100, blank=True)

    backing_gas = models.ForeignKey(
        "materials.GasFlux",
        on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
        limit_choices_to={"kind": "gas"},
        verbose_name="Защитный газ на поддув",
    )
    backing_gas_text = models.CharField("Газ на поддув (снимок)", max_length=100, blank=True)

    plasma_gas = models.ForeignKey(
        "materials.GasFlux",
        on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
        limit_choices_to={"kind": "gas"},
        verbose_name="Плазмообразующий газ",
    )
    plasma_gas_text = models.CharField(
        "Плазмообразующий газ (снимок)", max_length=100, blank=True
    )

    flux = models.ForeignKey(
        "materials.GasFlux",
        on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
        limit_choices_to={"kind": "flux"},
        verbose_name="Флюс",
    )
    flux_text = models.CharField("Флюс (снимок)", max_length=100, blank=True)

    plasma_nozzle_d = models.DecimalField(
        "Ø плазмообразующего сопла, мм",
        max_digits=5, decimal_places=1, null=True, blank=True,
    )

    # ---------- условия ----------
    heat_treatment = models.CharField("Термообработка", max_length=200, blank=True)

    # ---------- разделка ----------
    groove_type = models.CharField("Тип разделки", max_length=20, blank=True)
    groove_angle = models.DecimalField(
        "Угол разделки, °", max_digits=5, decimal_places=1, null=True, blank=True,
    )
    groove_gap = models.DecimalField(
        "Зазор b, мм", max_digits=5, decimal_places=1, null=True, blank=True,
    )
    groove_root = models.DecimalField(
        "Притупление c, мм", max_digits=5, decimal_places=1, null=True, blank=True,
    )
    groove_cap = models.DecimalField(
        "Усиление g, мм", max_digits=5, decimal_places=1, null=True, blank=True,
    )
    groove_root_cap = models.DecimalField(
        "Корень g₁, мм", max_digits=5, decimal_places=1, null=True, blank=True,
    )
    groove_width = models.DecimalField(
        "Ширина шва f, мм", max_digits=5, decimal_places=1, null=True, blank=True,
    )
    groove_svg = models.TextField("Эскиз (SVG)", blank=True)

    # ---------- специфика способа и установки ----------
    # редкие параметры по кодам EquipmentParameter: положение шва,
    # угол заточки, вылет электрода, развёртка луча
    extra = models.JSONField("Прочие параметры", default=dict, blank=True)

    # ---------- служебное ----------
    is_released = models.BooleanField(
        "Выпущена", default=False,
        help_text="Черновик правится свободно; выпущенная карта — документ, "
                  "по ней уже варят",
    )
    author = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="welding_cards",
        verbose_name="Автор",
    )
    author_name = models.CharField("Автор (снимок)", max_length=200, blank=True)
    created_at = models.DateTimeField("Создана", auto_now_add=True)
    updated_at = models.DateTimeField("Изменена", auto_now=True)

    class Meta:
        verbose_name = "Технологическая карта"
        verbose_name_plural = "Технологические карты"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["method"]),
            models.Index(fields=["equipment"]),
            models.Index(fields=["is_released"]),
        ]

    def save(self, *args, **kwargs):
        # снимки подписей: документ не должен меняться вслед за справочником
        for fk, snap in (("tungsten", "tungsten_text"), ("filler", "filler_text")):
            obj = getattr(self, fk)
            if obj and not getattr(self, snap):
                setattr(self, snap, str(obj))

        for fk, snap in (
            ("shield_gas", "shield_gas_text"),
            ("backing_gas", "backing_gas_text"),
            ("plasma_gas", "plasma_gas_text"),
            ("flux", "flux_text"),
        ):
            obj = getattr(self, fk)
            if obj and not getattr(self, snap):
                setattr(self, snap, obj.value)

        if self.author and not self.author_name:
            self.author_name = self.author.name

        super().save(*args, **kwargs)

    # ---------- то, что достаётся по цепочке, а не хранится ----------
    @property
    def seam(self):
        """Шов, который варится по этой карте — знает операция."""
        return self.operation.seam

    @property
    def part(self):
        """Деталь — тоже через операцию."""
        return self.operation.part

    @property
    def designation(self):
        """Обозначение способа с суффиксом: с присадкой «п», без — «б»."""
        base = self.method.designation
        if not base:
            return ""
        return f'{base}{"п" if self.filler_id else "б"}'

    def __str__(self):
        return f"Карта №{self.card_no} · {self.operation}"


class WeldPass(models.Model):
    """Проход сварки: режимы диапазонами.

    Это ПЛАН. Факт — сколько на самом деле шло тока и сколько времени —
    лежит в welding.WeldPassRun и ссылается сюда.
    """

    card = models.ForeignKey(
        WeldingCard, on_delete=models.CASCADE, related_name="passes",
        verbose_name="Карта",
    )
    no = models.PositiveSmallIntegerField("№ прохода")

    # --- ток и напряжение ---
    current_min = models.DecimalField(
        "Ток от, А", max_digits=7, decimal_places=1, null=True, blank=True,
    )
    current_max = models.DecimalField(
        "Ток до, А", max_digits=7, decimal_places=1, null=True, blank=True,
    )
    voltage_min = models.DecimalField(
        "Напряжение от, В", max_digits=6, decimal_places=1, null=True, blank=True,
    )
    voltage_max = models.DecimalField(
        "Напряжение до, В", max_digits=6, decimal_places=1, null=True, blank=True,
    )

    # --- скорость: введённая в единицах установки + каноническая в м/ч ---
    speed_unit = models.ForeignKey(
        "equipment.SpeedUnit",
        on_delete=models.PROTECT,
        null=True, blank=True, related_name="+",
        verbose_name="Единица скорости",
    )
    speed_raw_min = models.DecimalField(
        "Скорость от (в ед. установки)", max_digits=10, decimal_places=3,
        null=True, blank=True,
    )
    speed_raw_max = models.DecimalField(
        "Скорость до (в ед. установки)", max_digits=10, decimal_places=3,
        null=True, blank=True,
    )
    speed_min = models.DecimalField(
        "Скорость от, м/ч", max_digits=10, decimal_places=3, null=True, blank=True,
        help_text="Считается порталом, используется для поиска и статистики",
    )
    speed_max = models.DecimalField(
        "Скорость до, м/ч", max_digits=10, decimal_places=3, null=True, blank=True,
    )
    speed_required = models.BooleanField(
        "Скорость обязательна к соблюдению", default=False,
        help_text="У ручных способов скорость справочная; флаг включает "
                  "контроль по телеметрии",
    )

    # --- подача и газы ---
    wire_speed_min = models.DecimalField(
        "Подача проволоки от, м/мин", max_digits=7, decimal_places=2,
        null=True, blank=True,
    )
    wire_speed_max = models.DecimalField(
        "Подача проволоки до, м/мин", max_digits=7, decimal_places=2,
        null=True, blank=True,
    )
    gas_flow_min = models.DecimalField(
        "Расход защитного газа от, л/мин", max_digits=6, decimal_places=1,
        null=True, blank=True,
    )
    gas_flow_max = models.DecimalField(
        "Расход защитного газа до, л/мин", max_digits=6, decimal_places=1,
        null=True, blank=True,
    )
    backing_flow_min = models.DecimalField(
        "Расход газа на поддув от, л/мин", max_digits=6, decimal_places=1,
        null=True, blank=True,
    )
    backing_flow_max = models.DecimalField(
        "Расход газа на поддув до, л/мин", max_digits=6, decimal_places=1,
        null=True, blank=True,
    )
    plasma_flow_min = models.DecimalField(
        "Расход плазмообразующего от, л/мин", max_digits=6, decimal_places=1,
        null=True, blank=True,
    )
    plasma_flow_max = models.DecimalField(
        "Расход плазмообразующего до, л/мин", max_digits=6, decimal_places=1,
        null=True, blank=True,
    )

    # --- присадка ---
    filler = models.ForeignKey(
        "materials.FillerMaterial",
        on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
        verbose_name="Присадка на проходе",
        help_text="Заполняется, только если отличается от указанной в карте",
    )
    filler_text = models.CharField(
        "Присадка на проходе (снимок)", max_length=100, blank=True
    )
    filler_diameter = models.DecimalField(
        "Диаметр присадки, мм", max_digits=5, decimal_places=1, null=True, blank=True,
    )

    # --- импульсный режим ---
    # ВАЖНО для сверки с телеметрией: pulse_current сравнивается
    # с МАКСИМУМОМ замера за окно, pause_current — с МИНИМУМОМ,
    # а диапазон current_min/max — со СРЕДНИМ. Это разные величины,
    # путать нельзя
    pulse_current = models.DecimalField(
        "Ток импульса, А", max_digits=7, decimal_places=1, null=True, blank=True,
    )
    pulse_time = models.DecimalField(
        "Время импульса, с", max_digits=7, decimal_places=3, null=True, blank=True,
    )
    pause_current = models.DecimalField(
        "Ток паузы, А", max_digits=7, decimal_places=1, null=True, blank=True,
    )
    pause_time = models.DecimalField(
        "Время паузы, с", max_digits=7, decimal_places=3, null=True, blank=True,
    )

    # --- специфика ЭЛС ---
    beam_current = models.DecimalField(
        "Ток луча, мА", max_digits=8, decimal_places=2, null=True, blank=True,
    )

    # --- прочее по способу и установке ---
    extra = models.JSONField("Прочие параметры прохода", default=dict, blank=True)

    class Meta:
        verbose_name = "Проход"
        verbose_name_plural = "Проходы"
        ordering = ["card", "no"]
        unique_together = ["card", "no"]

    def save(self, *args, **kwargs):
        if self.filler and not self.filler_text:
            self.filler_text = str(self.filler)

        # пересчёт скорости в м/ч. Для угловых единиц нужен диаметр шва,
        # а он теперь живёт на шве, к которому карта привязана через операцию
        if self.speed_unit:
            diameter = None
            if self.card_id:
                seam = self.card.operation.seam
                diameter = seam.seam_diameter
            self.speed_min = self.speed_unit.to_canonical(self.speed_raw_min, diameter)
            self.speed_max = self.speed_unit.to_canonical(self.speed_raw_max, diameter)

        super().save(*args, **kwargs)

    def __str__(self):
        return f"Проход {self.no} (карта {self.card_id})"