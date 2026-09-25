# ЦЕХА УЧАСТКИ 

# Структура предприятия: цех → участок → рабочее место.
#
# Зачем три уровня, а не один:
#   цех          — организационная единица, к нему привязаны люди
#   участок      — часть цеха, где стоит оборудование одного передела
#   рабочее место — конкретный пост с аппаратом. Нужен для RFID-допуска:
#                   система должна знать, за каким постом стоит сварщик,
#                   и на дашборде «пост 14» понятнее, чем «цех 4»

from django.db import models


class Workshop(models.Model):
    """Цех."""

    name = models.CharField("Название", max_length=200)
    number = models.CharField("Номер", max_length=20, blank=True)

    class Meta:
        verbose_name = "Цех"
        verbose_name_plural = "Цеха"
        ordering = ["number", "name"]

    def __str__(self):
        return f"{self.number} — {self.name}" if self.number else self.name


class Section(models.Model):
    """Участок внутри цеха."""

    workshop = models.ForeignKey(
        Workshop,
        on_delete=models.PROTECT,
        related_name="sections",
        verbose_name="Цех",
    )
    name = models.CharField("Название", max_length=200)
    number = models.CharField("Номер", max_length=20, blank=True)

    class Meta:
        verbose_name = "Участок"
        verbose_name_plural = "Участки"
        ordering = ["workshop", "number", "name"]
        # номер участка уникален внутри своего цеха, а не по заводу
        constraints = [
            models.UniqueConstraint(
                fields=["workshop", "number"],
                condition=~models.Q(number=""),
                name="unique_section_number_per_workshop",
            )
        ]

    def __str__(self):
        return f"{self.workshop} · уч. {self.number or self.name}"


class Workstation(models.Model):
    """Рабочее место — пост, за которым стоит аппарат.

    Оборудование привязывается сюда, а не прямо к цеху: тогда на
    дашборде видно «пост 14», а узел телеметрии знает своё место.
    """

    section = models.ForeignKey(
        Section,
        on_delete=models.PROTECT,
        related_name="workstations",
        verbose_name="Участок",
    )
    number = models.CharField("Номер поста", max_length=20)
    name = models.CharField("Название", max_length=200, blank=True)
    is_active = models.BooleanField("В работе", default=True)

    class Meta:
        verbose_name = "Рабочее место"
        verbose_name_plural = "Рабочие места"
        ordering = ["section", "number"]
        constraints = [
            models.UniqueConstraint(
                fields=["section", "number"],
                name="unique_workstation_number_per_section",
            )
        ]

    @property
    def workshop(self):
        """Цех достаётся по цепочке, отдельным полем не хранится."""
        return self.section.workshop

    def __str__(self):
        return f"Пост {self.number}"
