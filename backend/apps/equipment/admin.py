from django.contrib import admin
from .models import Equipment, SpeedUnit, EquipmentParameter


@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ("name", "method", "workstation", "has_pulse", "is_active")
    list_filter = ("method", "workstation", "is_active")
    list_select_related = ("method", "workstation")
    search_fields = ("name", "method__name", "workshop__name")
    filter_horizontal = ("speed_units", "parameters")


@admin.register(SpeedUnit)
class SpeedUnitAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "is_angular", "to_m_per_h")
    list_filter = ("is_angular",)
    ordering = ("is_angular", "name")


@admin.register(EquipmentParameter)
class EquipmentParameterAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "unit", "level", "printed")
    list_filter = ("level", "printed")