from django.contrib import admin

from .models import Attestation, AttestationItem, AttestationRule


@admin.register(AttestationRule)
class AttestationRuleAdmin(admin.ModelAdmin):
    list_display = ("id", "method", "group", "th_from", "th_to", "is_active")
    list_filter = ("method", "group", "is_active")


class AttestationItemInline(admin.TabularInline):
    model = AttestationItem
    extra = 0
    fields = (
        "sample_no",
        "material1",
        "material2",
        "uniform",
        "thickness_min",
        "thickness_max",
        "wire",
        "flux",
        "gas",
        "position",
        "preheat",
        "heat_treatment",
    )


@admin.register(Attestation)
class AttestationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "welder",
        "method",
        "group",
        "kind",
        "status",
        "attested_at",
        "valid_until",
        "created_at",
    )
    list_filter = ("status", "kind", "method", "group", "valid_until")
    search_fields = ("welder__fio",)
    date_hierarchy = "created_at"
    inlines = (AttestationItemInline,)