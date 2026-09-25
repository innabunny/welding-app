# СВАРЩИКИ

from datetime import date
from django.db import models

class Welder(models.Model):
    fio = models.CharField('ФИО', max_length=200)
    birth_date = models.DateField('Дата рождения', null=True, blank=True)
    education = models.CharField('Образование', max_length=200)
    workshop = models.ForeignKey("workshops.Workshop", on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='welders', verbose_name='Цех / место работы')
    welding_since = models.DateField('Начало стажа по сварке', null=True, blank=True)
    rank = models.CharField('Квалификационный разряд', max_length=20, blank=True)
    is_active = models.BooleanField('Активен', default=True)
    rfid_uid = models.CharField(
        "UID карты (hex)",
        max_length=16,
        blank=True,
        unique=True,
        null=True,
        help_text="Канонический ключ — hex. Печатный номер на карте — "
                  "тот же UID в десятичном виде с нулями до 10 знаков",
    )
    personnel_no = models.CharField("Табельный номер", max_length=20, blank=True)

    class Meta:
        verbose_name = 'Сварщик'
        verbose_name_plural = 'Сварщики'
        ordering = ['fio']

    def __str__(self):
        return self.fio

    @staticmethod
    def _years_since(d):
        if not d:
            return None
        t = date.today()
        return t.year - d.year - ((t.month, t.day) < (d.month, d.day))

    @property
    def age(self):
        return self._years_since(self.birth_date)

    @property
    def experience_years(self):
        return self._years_since(self.welding_since)

    @property
    def is_attested(self):
        return self.attestations.filter(
            status='done', valid_until__gte=date.today()
        ).exists()
