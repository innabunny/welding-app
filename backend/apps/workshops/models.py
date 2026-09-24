# ЦЕХА УЧАСТКИ 
from django.db import models

class Workshop(models.Model):
    name = models.CharField("Название", max_length=200)
    number = models.CharField("Номер", max_length=20, blank=True)

    class Meta:
        verbose_name = "Цех"
        verbose_name_plural = "Цеха"
        ordering = ["number", "name"]

    def __str__(self):
        return f"{self.number} — {self.name}" if self.number else self.name
