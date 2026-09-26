from django.contrib import admin
from django.utils.html import format_html

from .models import ServiceRequest

@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "equipment",
        "reason",
        "priority_badge",
        "status",
        "author_name",
        "created_at",
        "closed_at",
    )
    list_filter = ("status", "priority", "reason", "equipment")
    list_select_related = ("equipment",)
    search_fields = ("equipment__name", "description", "author_name")
    date_hierarchy = "created_at"
    readonly_fields = ("author_name", "closed_by_name", "created_at", "closed_at")

    fieldsets = (
        ("Заявка", {
            "fields": ("equipment", "reason", "priority", "description"),
        }),
        ("Ход работ", {
            "fields": ("status", "resolution"),
        }),
        ("Служебное", {
            "classes": ("collapse",),
            "fields": (
                "author", "author_name", "created_at",
                "closed_by", "closed_by_name", "closed_at",
            ),
        }),
    )

    @admin.display(description="Срочность", ordering="priority")
    def priority_badge(self, obj):
        colors = {"высокая": "#b34242", "средняя": "#a8701c", "низкая": "#61727c"}
        return format_html(
            '<span style="color:{}">{}</span>',
            colors.get(obj.priority, "#61727c"),
            obj.get_priority_display(),
        )