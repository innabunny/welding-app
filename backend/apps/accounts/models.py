# ПОЛЬЗОВАТЕЛИ, ЦЕХА
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Пользователь портала. Наследуем AbstractUser, чтобы получить
    логин, пароль и права из коробки, и дописать своё."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Администратор"
        MASTER = "master", "Мастер"
        MECHANIC = "mechanic", "Механик"
        TECHNOLOGIST = "technologist", "Технолог"
        INSPECTOR = "inspector", "Контролёр"

    name = models.CharField("ФИО", max_length=200, blank=True)
    role = models.CharField("Роль", max_length=20, choices=Role.choices, blank=True)
    workshop = models.ForeignKey(
        "workshops.Workshop",
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="users",
        verbose_name="Цех",
    )

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"

    def __str__(self):
        return self.name or self.username