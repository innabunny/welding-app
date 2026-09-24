# МАРКИ, ГРУППЫ, ПРИСАДОЧНЫЕ ПРОВОЛОКИ, ГАЗЫ, ФЛЮСЫ

from django.db import models


class GasFlux(models.Model):
    class Kind(models.TextChoices):
        GAS = "gas", "Защитный / плазмообразующий газ"
        FLUX = "flux", "Флюс"

    kind = models.CharField("Тип", max_length=10, choices=Kind.choices)
    value = models.CharField("Марка", max_length=200)

    class Meta:
        verbose_name = "Газ / флюс"
        verbose_name_plural = "Газы и флюсы"
        ordering = ["kind", "value"]
        unique_together = ["kind", "value"]

    def __str__(self):
        return f"{self.get_kind_display()}: {self.value}"


class FillerMaterial(models.Model):
    class Kind(models.TextChoices):
        WIRE = "присадочная проволока", "Присадочная проволока"
        ELECTRODE = "электрод", "Покрытый электрод"
        TUNGSTEN = "вольфрам", "Вольфрамовый электрод"

    marka = models.CharField("Марка", max_length=100)
    kind = models.CharField("Тип", max_length=30, choices=Kind.choices)
    diameter = models.DecimalField(
        "Диаметр, мм", max_digits=4, decimal_places=1, null=True, blank=True
    )

    class Meta:
        verbose_name = "Сварочный материал"
        verbose_name_plural = "Сварочные материалы"
        ordering = ["kind", "marka"]
        unique_together = ["marka", "diameter", "kind"]

    def __str__(self):
        d = f" Ø{self.diameter}" if self.diameter else ""
        return f"{self.marka}{d}"


class MaterialGroup(models.Model):
    code = models.CharField("Группа", max_length=100, unique=True)
    class Meta:
        verbose_name = "Группа материалов"
        verbose_name_plural = "Группы материалов"
        ordering = ["code"]

    def __str__(self):
        return self.code


class Material(models.Model):
    marka = models.CharField("Марка", max_length=100)
    group = models.ForeignKey(
        MaterialGroup,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="materials",
        verbose_name="Группа",
    )
    tensile_strength = models.DecimalField(
        "Предел прочности, кгс/мм²",
        max_digits=6,
        decimal_places=1,
        null=True,
        blank=True,
    )
    analogs = models.ManyToManyField(
        'self', blank=True, symmetrical=True,
        verbose_name='Материалы-аналоги',
        help_text='Марки со схожей свариваемостью — на их режимы можно ориентироваться',
    )

    class Meta:
        verbose_name = "Основной материал"
        verbose_name_plural = "Основные материалы"
        ordering = ["marka"]

    def __str__(self):
        return self.marka

class MaterialPair(models.Model):
    """Сочетание свариваемых материалов и допустимые для него
    присадочные материалы и флюсы. Заполняет технолог."""

    material_1 = models.ForeignKey(
        Material, on_delete=models.CASCADE, related_name='pairs_as_first',
        verbose_name='Материал 1',
    )
    material_2 = models.ForeignKey(
        Material, on_delete=models.CASCADE, related_name='pairs_as_second',
        verbose_name='Материал 2',
    )
    fillers = models.ManyToManyField(
        FillerMaterial, blank=True, related_name='pairs',
        verbose_name='Допустимые присадочные материалы',
    )
    fluxes = models.ManyToManyField(
        GasFlux, blank=True, related_name='pairs',
        limit_choices_to={'kind': 'flux'}, verbose_name='Допустимые флюсы',
    )
    note = models.TextField('Примечание', blank=True)

    class Meta:
        verbose_name = 'Сочетание материалов'
        verbose_name_plural = 'Сочетания материалов'
        unique_together = ['material_1', 'material_2']
        ordering = ['material_1__marka', 'material_2__marka']

    def save(self, *args, **kwargs):
        if self.material_1_id > self.material_2_id:
            self.material_1_id, self.material_2_id = self.material_2_id, self.material_1_id
        super().save(*args, **kwargs)    

    def __str__(self):
        return f'{self.material_1} + {self.material_2}'