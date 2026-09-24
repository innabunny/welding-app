# Способы сварки
from django.db import models

class WeldingMethod(models.Model):
    """Способ сварки. process группирует родственные способы:
    при нехватке карт по способу статистику расширяем на весь процесс."""

    class Process(models.TextChoices):
        TIG = "tig", "Неплавящийся электрод в защитном газе"
        MIG = "mig", "Плавящийся электрод в защитном газе"
        PLASMA = "plasma", "Плазменная"
        EBW = "ebw", "Электронно-лучевая"
        DIFF = "diff", "Диффузионная"
        CONTACT = "contact", "Контактная"
        LASER = "laser", "Лазерная"

    id = models.SlugField("Код", max_length=20, primary_key=True)  # tig1
    name = models.CharField("Название", max_length=300)
    designation = models.CharField(
        "Базовое обозначение",
        max_length=20,
        blank=True,
        help_text="Без суффикса п/б — он подставляется по наличию присадки",
    )
    process = models.CharField("Процесс", max_length=20, choices=Process.choices)
    tpl_key = models.CharField("Шаблон бланка", max_length=30, blank=True)
    order = models.PositiveSmallIntegerField("Порядок", default=0)
    is_active = models.BooleanField("Используется", default=True)

    class Meta:
        verbose_name = "Способ сварки"
        verbose_name_plural = "Способы сварки"
        ordering = ["order"]

    def __str__(self):
        return self.name
