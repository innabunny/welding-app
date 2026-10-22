from django.contrib import admin

from .models import CalendarException, ShiftDay, ShiftSchedule


class ShiftDayInline(admin.TabularInline):
    """Дни недели правятся внутри графика, а не отдельной страницей.

    TabularInline — таблица дочерних записей прямо в форме родителя.
    Семь строк на график, заводить их по одной было бы мучением.
    """

    model = ShiftDay
    extra = 0
    fields = ["weekday", "is_working", "starts_at", "ends_at", "break_start", "break_end"]
    ordering = ["weekday"]


@admin.register(ShiftSchedule)
class ShiftScheduleAdmin(admin.ModelAdmin):
    list_display = ["__str__", "name", "workshop", "number", "valid_from", "valid_to"]
    list_filter = ["workshop", "number"]
    inlines = [ShiftDayInline]
    # подтягивает цех одним запросом вместо запроса на каждую строку
    list_select_related = ["workshop"]


@admin.register(CalendarException)
class CalendarExceptionAdmin(admin.ModelAdmin):
    list_display = ["day", "kind", "schedule", "comment"]
    list_filter = ["kind", "schedule"]
    date_hierarchy = "day"   # навигация по годам и месяцам сверху списка