from django.contrib import admin
from .models import Equipment, SpeedUnit, EquipmentParameter

@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ("name", "method", "workshop", "has_pulse", "is_active")
    list_filter = ("method", "workshop", "is_active")
    filter_horizontal = ("speed_units", "parameters")


@admin.register(SpeedUnit)
class SpeedUnitAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "is_angular", "to_m_per_h")


@admin.register(EquipmentParameter)
class EquipmentParameterAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "unit", "level", "printed")
    list_filter = ("level", "printed")