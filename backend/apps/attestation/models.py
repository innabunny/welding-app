# АТТЕСТАЦИИБ ОБРАЗЦЫ, ПРАВИЛА 

# attestation/models.py
from django.db import models
from datetime import date

class AttestationRule(models.Model):
    method = models.ForeignKey(
        "methods.WeldingMethod", on_delete=models.PROTECT, related_name="rules"
    )
    group = models.ForeignKey(
        "materials.MaterialGroup", on_delete=models.PROTECT, related_name="rules"
    )
    th_from = models.DecimalField("Толщина от, мм", max_digits=5, decimal_places=1)
    th_to = models.DecimalField(
        "Толщина до, мм", max_digits=5, decimal_places=1, null=True, blank=True
    )  # null = «и выше»
    required_output = models.JSONField("Требования", default=dict)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Правило аттестации"
        verbose_name_plural = "Библиотека правил"
        ordering = ["method", "group", "th_from"]

    def __str__(self):
        top = self.th_to if self.th_to is not None else "∞"
        return f"{self.method} · {self.group} · {self.th_from}–{top} мм"


class Attestation(models.Model):
    # срок аттестации
    VALIDITY_YEARS = 3

    STATUS_CHOICES = [
        ("draft", "Черновик / заявки"),
        ("testing", "Ждём испытаний"),
        ("protocol", "Составление протокола"),
        ("review", "Согласование"),
        ("done", "Аттестован"),
    ]

    welder = models.ForeignKey(
        "welders.Welder",
        on_delete=models.PROTECT,
        related_name="attestations",
        verbose_name="Сварщик",
    )
    method = models.ForeignKey(
        "methods.WeldingMethod", on_delete=models.PROTECT, verbose_name="Способ сварки"
    )
    group = models.ForeignKey(
        "materials.MaterialGroup", on_delete=models.PROTECT, verbose_name="Группа материала"
    )
    controls = models.JSONField("Виды контроля", default=list)  # ['вик','рк',...]
    status = models.CharField(
        "Статус", max_length=20, choices=STATUS_CHOICES, default="draft"
    )
    created_at = models.DateTimeField("Создана", auto_now_add=True)

    attested_at = models.DateField("Дата аттестации", null=True, blank=True)
    valid_until = models.DateField("Действует до", null=True, blank=True)
    protocol_no = models.CharField("№ протокола", max_length=50, blank=True)
    certificate_no = models.CharField("№ удостоверения", max_length=50, blank=True)

    class Kind(models.TextChoices):
        PRIMARY = "первичная", "Первичная"
        PERIODIC = "периодическая", "Периодическая"

    kind = models.CharField(
        "Вид аттестации",
        max_length=20,
        choices=Kind.choices,
        default=Kind.PRIMARY,
    )

    class Meta:
        verbose_name = "Аттестация"
        verbose_name_plural = "Аттестации"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if self.attested_at and not self.valid_until:
            self.valid_until = self.attested_at.replace(
                year=self.attested_at.year + self.VALIDITY_YEARS
            )
        super().save(*args, **kwargs)

    @property
    def expiry_state(self):
        """'' | 'valid' | 'soon' | 'expired' — для цветной плашки в реестре."""
        if not self.valid_until:
            return ""
        left = (self.valid_until - date.today()).days
        if left < 0:
            return "expired"
        if left <= 60:
            return "soon"
        return "valid"

    def __str__(self):
        return f"{self.welder} · {self.method} ({self.get_status_display()})"


class AttestationItem(models.Model):
    attestation = models.ForeignKey(
        Attestation,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Аттестация",
    )
    sample_no = models.CharField("№ образца", max_length=50)
    material1 = models.ForeignKey(
        "materials.Material", on_delete=models.PROTECT, related_name="+", verbose_name="Материал 1"
    )
    material2 = models.ForeignKey(
        "materials.Material", on_delete=models.PROTECT, related_name="+", verbose_name="Материал 2"
    )
    uniform = models.BooleanField("Однородное", default=False)
    thickness_min = models.DecimalField(
        "Толщина от", max_digits=5, decimal_places=1, null=True, blank=True
    )
    thickness_max = models.DecimalField(
        "Толщина до", max_digits=5, decimal_places=1, null=True, blank=True
    )
    wire = models.ForeignKey(
        "materials.FillerMaterial",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="Электрод / проволока",
    )
    wire_text = models.CharField(
        "Электрод / проволока (снимок)", max_length=100, blank=True
    )

    flux = models.ForeignKey(
        "materials.GasFlux",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        limit_choices_to={"kind": "flux"},
        verbose_name="Флюс",
    )
    flux_text = models.CharField("Флюс (снимок)", max_length=100, blank=True)
    gas = models.ForeignKey(
        "materials.GasFlux",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        limit_choices_to={"kind": "gas"},
        verbose_name="Защитный газ",
    )
    gas_text = models.CharField("Защитный газ (снимок)", max_length=100, blank=True)
    position = models.CharField("Положение", max_length=50, blank=True)
    preheat = models.CharField("Подогрев", max_length=50, blank=True)
    heat_treatment = models.CharField("Термообработка", max_length=50, blank=True)

    def save(self, *args, **kwargs):
        if self.wire and not self.wire_text:
            self.wire_text = str(self.wire)
        if self.flux and not self.flux_text:
            self.flux_text = self.flux.value
        if self.gas and not self.gas_text:
            self.gas_text = self.gas.value
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Образец аттестации"
        verbose_name_plural = "Образцы аттестации"

    def __str__(self):
        return f'Образец {self.sample_no or "—"} ({self.attestation_id})'