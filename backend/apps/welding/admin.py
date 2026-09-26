from django.contrib import admin
from django.utils.html import format_html

from .models import (
    ArcRun,
    Inspection,
    OperationRun,
    PartInstance,
    Weld,
    WeldingSession,
    WeldPassRun,
)


class WeldInline(admin.TabularInline):
    model = Weld
    extra = 0
    fields = ("seam", "status")
    show_change_link = True


class WeldPassRunInline(admin.TabularInline):
    model = WeldPassRun
    extra = 0
    fields = ("no", "planned_pass", "started_at", "finished_at", "arc_time", "match_source")


class InspectionInline(admin.TabularInline):
    model = Inspection
    extra = 0
    fields = ("kind", "method", "specimen", "result", "report_no", "inspected_at")
    show_change_link = True


class OperationRunInline(admin.TabularInline):
    model = OperationRun
    extra = 0
    fields = ("operation", "card", "welder", "equipment", "status", "finished_at")
    show_change_link = True


class ArcRunInline(admin.TabularInline):
    model = ArcRun
    extra = 0
    fields = (
        "started_at", "finished_at",
        "current_avg", "current_min", "current_max",
        "voltage_avg", "pulse_freq", "telemetry_complete",
    )
    readonly_fields = fields  # пишет узел телеметрии, руками не правим


@admin.register(PartInstance)
class PartInstanceAdmin(admin.ModelAdmin):
    list_display = ("part", "serial_no", "kind", "witness_for", "created_at")
    list_filter = ("kind", "part")
    list_select_related = ("part", "witness_for")
    search_fields = ("serial_no", "part__number", "part__name")
    inlines = (WeldInline,)


@admin.register(Weld)
class WeldAdmin(admin.ModelAdmin):
    list_display = ("__str__", "status", "runs_count", "created_at")
    list_filter = ("status", "instance__part")
    list_select_related = ("instance", "instance__part", "seam")
    search_fields = ("instance__serial_no", "instance__part__number", "seam__number")
    inlines = (OperationRunInline,)

    @admin.display(description="Операций")
    def runs_count(self, obj):
        return obj.runs.count()


@admin.register(OperationRun)
class OperationRunAdmin(admin.ModelAdmin):
    list_display = (
        "__str__", "card", "welder", "equipment",
        "status", "shrinkage_display", "finished_at",
    )
    list_filter = ("status", "equipment", "welder")
    list_select_related = (
        "weld", "weld__instance", "operation", "card", "welder", "equipment",
    )
    inlines = (WeldPassRunInline, InspectionInline)

    @admin.display(description="Усадка, мм")
    def shrinkage_display(self, obj):
        value = obj.shrinkage
        return value if value is not None else "—"


@admin.register(Inspection)
class InspectionAdmin(admin.ModelAdmin):
    list_display = (
        "run", "kind", "method", "specimen",
        "result_badge", "report_no", "inspected_at",
    )
    list_filter = ("method", "result", "specimen", "kind")
    list_select_related = ("run", "run__weld", "run__weld__instance")
    search_fields = ("report_no", "conclusion")
    date_hierarchy = "inspected_at"
    readonly_fields = ("inspector_name",)

    @admin.display(description="Результат", ordering="result")
    def result_badge(self, obj):
        colors = {"годен": "#24785a", "исправление": "#a8701c", "брак": "#b34242"}
        return format_html(
            '<span style="color:{}">{}</span>',
            colors.get(obj.result, "#61727c"),
            obj.get_result_display(),
        )


@admin.register(WeldingSession)
class WeldingSessionAdmin(admin.ModelAdmin):
    list_display = (
        "started_at", "equipment", "welder_name",
        "mode", "operation_run", "arcs_count", "finished_at",
    )
    list_filter = ("mode", "equipment")
    list_select_related = ("equipment", "welder", "operation_run")
    search_fields = ("welder_name", "route_code_raw")
    date_hierarchy = "started_at"
    readonly_fields = ("welder_name", "route_code_raw")
    inlines = (ArcRunInline,)

    @admin.display(description="Участков дуги")
    def arcs_count(self, obj):
        return obj.arcs.count()