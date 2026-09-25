from django.contrib import admin
from django.db.models import Count

from .models import Section, Workshop, Workstation


class SectionInline(admin.TabularInline):
    """Участки прямо в карточке цеха."""

    model = Section
    extra = 0
    fields = ("number", "name")
    show_change_link = True


class WorkstationInline(admin.TabularInline):
    """Посты прямо в карточке участка."""

    model = Workstation
    extra = 0
    fields = ("number", "name", "is_active")


@admin.register(Workshop)
class WorkshopAdmin(admin.ModelAdmin):
    list_display = ("number", "name", "sections_count", "welders_count")
    search_fields = ("name", "number")
    ordering = ("number", "name")
    inlines = (SectionInline,)

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _sections=Count("sections", distinct=True),
            _welders=Count("welders", distinct=True),
        )

    @admin.display(description="Участков", ordering="_sections")
    def sections_count(self, obj):
        return obj._sections

    @admin.display(description="Сварщиков", ordering="_welders")
    def welders_count(self, obj):
        return obj._welders


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("number", "name", "workshop", "workstations_count")
    list_filter = ("workshop",)
    list_select_related = ("workshop",)
    search_fields = ("name", "number", "workshop__name")
    inlines = (WorkstationInline,)

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _stations=Count("workstations", distinct=True),
        )

    @admin.display(description="Постов", ordering="_stations")
    def workstations_count(self, obj):
        return obj._stations


@admin.register(Workstation)
class WorkstationAdmin(admin.ModelAdmin):
    list_display = ("number", "name", "section", "workshop_name", "is_active")
    list_filter = ("section__workshop", "section", "is_active")
    list_select_related = ("section", "section__workshop")
    search_fields = ("number", "name")

    @admin.display(description="Цех", ordering="section__workshop__number")
    def workshop_name(self, obj):
        return obj.section.workshop