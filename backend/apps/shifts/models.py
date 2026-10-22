# Рабочее время: графики смен и производственный календарь.
#
# Зачем это нужно. Коэффициент загрузки (Кз) — это доля времени, когда
# аппарат реально варил, от того времени, когда он ДОЛЖЕН был работать.
# Второе число из телеметрии не получить: если сварщик весь день не
# подходил к аппарату, в телеметрии не будет ничего, и делить будет
# не на что. Поэтому фонд времени берётся из графика смен.
#
# Три таблицы, потому что это три разные по природе вещи:
#   ShiftSchedule     — правило («первая смена цеха 3»), живёт годами
#   ShiftDay          — часы внутри правила, своя строка на день недели
#   CalendarException — отдельные даты: праздники, переносы, сокращения

from datetime import date as date_cls
from datetime import datetime, time, timedelta

from django.core.exceptions import ValidationError
from django.db import models


class ShiftSchedule(models.Model):
    """График работы: кто и по каким дням работает.

    Привязан к цеху. Если цех не указан — это график по умолчанию,
    он применяется ко всем цехам, у которых своего нет. Так не надо
    заводить одинаковый график каждому производственному цеху.
    """

    name = models.CharField("название", max_length=120)

    # on_delete=PROTECT: нельзя удалить цех, пока на него ссылается
    # график. Иначе расчёты за прошлые месяцы потеряют основание
    workshop = models.ForeignKey(
        "workshops.Workshop",
        verbose_name="цех",
        on_delete=models.PROTECT,
        related_name="shift_schedules",
        null=True,
        blank=True,
        help_text="Пусто — график по умолчанию для всех цехов",
    )

    # Номер смены. Сейчас смена одна, но поле есть сразу: добавить
    # вторую смену потом — это новая строка, а не переделка расчётов
    number = models.PositiveSmallIntegerField("номер смены", default=1)

    # Период действия графика. Когда завод поменяет часы, старый
    # график не удаляют, а закрывают датой — тогда Кз за прошлый год
    # останется посчитанным по тем правилам, что действовали тогда
    valid_from = models.DateField("действует с", default=date_cls.today)
    valid_to = models.DateField("действует по", null=True, blank=True)

    class Meta:
        verbose_name = "график смен"
        verbose_name_plural = "графики смен"
        # Один цех — один график на смену за период. unique_together
        # не подходит: valid_to бывает пустым, и база считает NULL
        # не равным никакому другому NULL, то есть дубли пройдут
        ordering = ["workshop__name", "number"]

    def __str__(self):
        where = self.workshop.name if self.workshop else "все цеха"
        return f"{where}, смена {self.number}"

    def is_active_on(self, day: date_cls) -> bool:
        """Действует ли график на эту дату."""
        if day < self.valid_from:
            return False
        return self.valid_to is None or day <= self.valid_to


class ShiftDay(models.Model):
    """Часы одного дня недели внутри графика.

    Семь строк на график. Выходной — это строка с is_working=False,
    а не отсутствие строки: так видно, что день рассмотрен,
    а не забыт при заполнении.
    """

    WEEKDAYS = [
        (0, "понедельник"),
        (1, "вторник"),
        (2, "среда"),
        (3, "четверг"),
        (4, "пятница"),
        (5, "суббота"),
        (6, "воскресенье"),
    ]

    schedule = models.ForeignKey(
        ShiftSchedule,
        verbose_name="график",
        on_delete=models.CASCADE,   # удалили график — дни не нужны
        related_name="days",
    )
    weekday = models.PositiveSmallIntegerField("день недели", choices=WEEKDAYS)
    is_working = models.BooleanField("рабочий день", default=True)

    starts_at = models.TimeField("начало", null=True, blank=True)
    ends_at = models.TimeField("конец", null=True, blank=True)
    break_start = models.TimeField("обед с", null=True, blank=True)
    break_end = models.TimeField("обед по", null=True, blank=True)

    class Meta:
        verbose_name = "день графика"
        verbose_name_plural = "дни графика"
        unique_together = ["schedule", "weekday"]
        ordering = ["schedule", "weekday"]

    def __str__(self):
        if not self.is_working:
            return f"{self.get_weekday_display()}: выходной"
        return f"{self.get_weekday_display()}: {self.starts_at}–{self.ends_at}"

    def clean(self):
        """Проверки перед сохранением.

        clean вызывается формами и админкой. Нужен, чтобы в базу
        не попал рабочий день без времени или обед вне смены —
        такие строки потом дадут отрицательный фонд времени.
        """
        if not self.is_working:
            return
        if not self.starts_at or not self.ends_at:
            raise ValidationError("У рабочего дня должно быть время начала и конца")
        if self.ends_at <= self.starts_at:
            raise ValidationError("Конец смены должен быть позже начала")

        has_break = bool(self.break_start) or bool(self.break_end)
        if has_break:
            if not (self.break_start and self.break_end):
                raise ValidationError("Обед задаётся обеими границами")
            if self.break_end <= self.break_start:
                raise ValidationError("Конец обеда должен быть позже начала")
            if self.break_start < self.starts_at or self.break_end > self.ends_at:
                raise ValidationError("Обед должен попадать внутрь смены")

    @property
    def work_seconds(self) -> int:
        """Рабочее время дня в секундах, без обеда."""
        if not self.is_working or not self.starts_at or not self.ends_at:
            return 0
        total = _seconds_between(self.starts_at, self.ends_at)
        if self.break_start and self.break_end:
            total -= _seconds_between(self.break_start, self.break_end)
        return max(total, 0)


class CalendarException(models.Model):
    """Отдельная дата, которая не подчиняется графику.

    Праздник, перенос выходного, сокращённый день. Хранится списком,
    потому что это не правило, а исключение из него.
    """

    KINDS = [
        ("нерабочий", "нерабочий день"),
        ("рабочий", "рабочий день вместо выходного"),
        ("сокращённый", "сокращённый день"),
    ]

    day = models.DateField("дата")
    kind = models.CharField("вид", max_length=20, choices=KINDS)
    comment = models.CharField("примечание", max_length=200, blank=True)

    # Пусто — исключение действует на все графики (обычный праздник).
    # Заполнено — только на этот график (цех работает в праздник)
    schedule = models.ForeignKey(
        ShiftSchedule,
        verbose_name="только для графика",
        on_delete=models.CASCADE,
        related_name="exceptions",
        null=True,
        blank=True,
    )

    # Для рабочего или сокращённого дня: своё время вместо обычного.
    # Если пусто — берётся время того дня недели, на который попала дата
    starts_at = models.TimeField("начало", null=True, blank=True)
    ends_at = models.TimeField("конец", null=True, blank=True)
    break_start = models.TimeField("обед с", null=True, blank=True)
    break_end = models.TimeField("обед по", null=True, blank=True)

    class Meta:
        verbose_name = "исключение календаря"
        verbose_name_plural = "производственный календарь"
        unique_together = ["day", "schedule"]
        ordering = ["-day"]

    def __str__(self):
        return f"{self.day:%d.%m.%Y} — {self.get_kind_display()}"


def _seconds_between(a: time, b: time) -> int:
    """Сколько секунд между двумя временами одних суток.

    datetime.time вычитать нельзя — Python не разрешает, потому что
    из двух «часов на циферблате» без даты не ясно, сколько прошло.
    Поэтому склеиваем с произвольной одинаковой датой и вычитаем уже
    полноценные момент
    """
    base = date_cls(2000, 1, 1)
    return int((datetime.combine(base, b) - datetime.combine(base, a)).total_seconds())


def _as_td(seconds: int) -> timedelta:
    return timedelta(seconds=seconds)