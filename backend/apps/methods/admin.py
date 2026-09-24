from django.contrib import admin

from .models import WeldingMethod


@admin.register(WeldingMethod)
class WeldingMethodAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "designation", "process", "order", "is_active")
    list_filter = ("process", "is_active")
    ordering = ("order",)