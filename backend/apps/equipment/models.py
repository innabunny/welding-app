# УСТАНОВКИ, ЕДИНИЦЫ СКОРОСТИ, ПАРАМЕТРЫ
from django.db import models


class SpeedUnit(models.Model):
    """Единица скорости сварки. Новые добавляются через админку."""

    code = models.SlugField("Код", max_length=20, unique=True)  # m_per_h
    name = models.CharField("Обозначение", max_length=20)  # м/ч
    is_angular = models.BooleanField(
        "Угловая",
        default=False,
        help_text="Для пересчёта в м/ч нужен диаметр шва (об/мин, град/с)",
    )
    to_m_per_h = models.DecimalField(
        "Коэффициент пересчёта в м/ч",
        max_digits=14,
        decimal_places=8,
        null=True,
        blank=True,
        help_text="Для линейных: во сколько раз больше м/ч. "
        "Для угловых: множитель к π·D·об (D в метрах)",
    )

    class Meta:
        verbose_name = "Единица скорости"
        verbose_name_plural = "Единицы скорости"
        ordering = ["name"]

    def to_canonical(self, value, diameter_mm=None):
        """Перевести значение в м/ч. None, если пересчёт невозможен."""
        if value is None or self.to_m_per_h is None:
            return None
        if not self.is_angular:
            return value * self.to_m_per_h
        if not diameter_mm:
            return None
        from decimal import Decimal
        import math

        circumference_m = Decimal(str(math.pi)) * Decimal(diameter_mm) / Decimal(1000)
        return value * circumference_m * self.to_m_per_h

    def __str__(self):
        return self.name




class EquipmentParameter(models.Model):
    """Дополнительный параметр установки: циклограммы, колебания,
    тонкие настройки импульса. Значения ложатся в extra карты или прохода."""

    class Level(models.TextChoices):
        CARD = "card", "На всю карту"
        PASS = "pass", "На каждый проход"

    code = models.SlugField("Код", max_length=40, unique=True)  # osc_amplitude
    name = models.CharField("Название", max_length=200)  # Амплитуда колебаний
    unit = models.CharField("Единица", max_length=20, blank=True)  # мм
    level = models.CharField("Уровень", max_length=10, choices=Level.choices)
    printed = models.BooleanField("Печатать в техкарте", default=True)
    order = models.PositiveSmallIntegerField("Порядок", default=0)

    class Meta:
        verbose_name = "Параметр оборудования"
        verbose_name_plural = "Параметры оборудования"
        ordering = ["level", "order", "name"]

    def __str__(self):
        u = f", {self.unit}" if self.unit else ""
        return f"{self.name}{u}"


class Equipment(models.Model):
    """Сварочная установка."""

    name = models.CharField("Название", max_length=200)
    workstation = models.ForeignKey(
        "workshops.Workstation",
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="equipment",
        verbose_name="Рабочее место",
    )

    # идентификатор узла телеметрии: по нему приходящие данные
    # находят свой аппарат
    node_id = models.CharField(
        "Идентификатор узла телеметрии", max_length=50,
        blank=True, null=True, unique=True,
        help_text="MAC или серийный номер платы WT32-ETH01",
    )
    node_ip = models.GenericIPAddressField(
        "IP узла", null=True, blank=True,
    )
    method = models.ForeignKey(
        "methods.WeldingMethod",
        on_delete=models.PROTECT,
        related_name="equipment",
        verbose_name="Способ сварки",
    )
    speed_units = models.ManyToManyField(
        SpeedUnit,
        blank=True,
        verbose_name="Рабочие единицы скорости",
        help_text="Кольцевой шов — об/мин, прямой — м/ч; у установки может быть несколько",
    )
    has_pulse = models.BooleanField("Импульсный режим", default=False)
    parameters = models.ManyToManyField(
        EquipmentParameter,
        blank=True,
        verbose_name="Дополнительные параметры",
    )
    is_active = models.BooleanField("В работе", default=True)

    class Meta:
        verbose_name = "Оборудование"
        verbose_name_plural = "Оборудование"
        ordering = ["method", "name"]

    @property
    def workshop(self):
        return self.workstation.section.workshop if self.workstation else None

    def __str__(self):
        return self.name

