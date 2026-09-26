# Заявки на обслуживание оборудования.
# Мастер подаёт, механик и администратор закрывают.

from django.db import models

class ServiceRequest(models.Model):
    """Заявка на обслуживание установки."""

    class Reason(models.TextChoices):
        REPAIR = "ремонт", "Ремонт"
        DIAGNOSTICS = "диагностика", "Диагностика"
        FAILURE = "неисправность", "Неисправность"
        MAINTENANCE = "то", "Плановое ТО"

    class Priority(models.TextChoices):
        LOW = "низкая", "Низкая"
        NORMAL = "средняя", "Средняя"
        HIGH = "высокая", "Высокая"

    class Status(models.TextChoices):
        OPEN = "open", "Подана"
        IN_WORK = "in_work", "В работе"
        DONE = "done", "Выполнена"
        REJECTED = "rejected", "Отклонена"

    equipment = models.ForeignKey(
        "equipment.Equipment",
        on_delete=models.PROTECT,
        related_name="service_requests",
        verbose_name="Оборудование",
    )

    reason = models.CharField("Причина", max_length=20, choices=Reason.choices)
    priority = models.CharField(
        "Срочность", max_length=20,
        choices=Priority.choices, default=Priority.NORMAL,
    )
    description = models.TextField("Описание", blank=True)

    status = models.CharField(
        "Статус", max_length=20, choices=Status.choices, default=Status.OPEN,
    )

    # --- кто подал ---
    author = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="service_requests",
        verbose_name="Заявитель",
    )
    author_name = models.CharField("Заявитель (снимок)", max_length=200, blank=True)
    created_at = models.DateTimeField("Подана", auto_now_add=True)

    # --- кто закрыл ---
    closed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="closed_service_requests",
        verbose_name="Кто закрыл",
    )
    closed_by_name = models.CharField("Кто закрыл (снимок)", max_length=200, blank=True)
    closed_at = models.DateTimeField("Закрыта", null=True, blank=True)
    resolution = models.TextField("Что сделано", blank=True)

    class Meta:
        verbose_name = "Заявка на обслуживание"
        verbose_name_plural = "Заявки на обслуживание"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["equipment", "status"]),
        ]

    def save(self, *args, **kwargs):
        # снимки фамилий: учётку удалят, а в истории должно остаться,
        # кто подавал и кто закрывал
        if self.author and not self.author_name:
            self.author_name = self.author.name
        if self.closed_by and not self.closed_by_name:
            self.closed_by_name = self.closed_by.name
        super().save(*args, **kwargs)

    @property
    def is_open(self):
        return self.status in (self.Status.OPEN, self.Status.IN_WORK)

    def __str__(self):
        return f"Заявка №{self.pk} · {self.equipment} · {self.get_status_display()}"