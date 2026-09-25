from django.contrib import admin

from .models import WeldingCard, WeldPass


class WeldPassInline(admin.TabularInline):
    model = WeldPass
    extra = 0
    fields = (
        "no",
        "current_min", "current_max",
        "voltage_min", "voltage_max",
        "speed_unit", "speed_raw_min", "speed_raw_max",
        "speed_min", "speed_max",
        "speed_required",
        "gas_flow_min", "gas_flow_max",
    )
    # скорость в м/ч считает save() модели — показываем, но не даём править
    readonly_fields = ("speed_min", "speed_max")


@admin.register(WeldingCard)
class WeldingCardAdmin(admin.ModelAdmin):
    list_display = (
        "card_no",
        "revision",
        "part_number",
        "operation_number",
        "seam_number",
        "method",
        "equipment",
        "is_released",
        "created_at",
    )
    list_filter = ("method", "equipment", "is_released", "welding_mode")
    search_fields = (
        "card_no",
        "operation__part__number",
        "operation__part__name",
    )
    date_hierarchy = "created_at"
    inlines = (WeldPassInline,)
    readonly_fields = ("author_name", "created_at", "updated_at")

    def get_queryset(self, request):
        # деталь, операция и шов показываются колонками — тянем сразу
        return super().get_queryset(request).select_related(
            "operation__part", "operation__seam", "method", "equipment"
        )

    @admin.display(description="Деталь", ordering="operation__part__number")
    def part_number(self, obj):
        return obj.operation.part.number

    @admin.display(description="Операция", ordering="operation__number")
    def operation_number(self, obj):
        return obj.operation.number

    @admin.display(description="Шов")
    def seam_number(self, obj):
        return obj.operation.seam.number

    fieldsets = (
        ("Документ", {
            "fields": ("operation", "card_no", "revision", "is_released"),
            "description": (
                "Деталь, номер операции и шов берутся из выбранной операции. "
                "Материалы и толщина — из шва."
            ),
        }),
        ("Технология", {
            "fields": ("method", "equipment", "welding_mode"),
        }),
        ("Сварочные материалы и среда", {
            "fields": (
                "tungsten", "filler",
                "shield_gas", "backing_gas", "plasma_gas", "flux",
                "plasma_nozzle_d",
            ),
        }),
        ("Термообработка", {
            "fields": ("heat_treatment",),
        }),
        ("Разделка", {
            "classes": ("collapse",),
            "fields": (
                "groove_type", "groove_angle", "groove_gap", "groove_root",
                "groove_cap", "groove_root_cap", "groove_width", "groove_svg",
            ),
        }),
        ("Снимки для документа", {
            "classes": ("collapse",),
            "description": (
                "Заполняются сами при первом сохранении и дальше не меняются "
                "вслед за справочником. Править вручную только если в документе "
                "действительно нужен другой текст."
            ),
            "fields": (
                "tungsten_text", "filler_text", "shield_gas_text",
                "backing_gas_text", "plasma_gas_text", "flux_text",
            ),
        }),
        ("Служебное", {
            "classes": ("collapse",),
            "fields": ("extra", "author", "author_name", "created_at", "updated_at"),
        }),
    )