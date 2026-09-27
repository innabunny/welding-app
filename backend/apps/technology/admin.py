from django.contrib import admin

from .models import Operation, Part, SeamSpec


class SeamInline(admin.TabularInline):
    model = SeamSpec
    extra = 0
    fields = ("number", "joint_type", "material_1", "material_2", "thickness_1", "thickness_2", "seam_type", "seam_diameter")
    show_change_link = True


class OperationInline(admin.TabularInline):
    model = Operation
    extra = 0
    fields = ("order", "number", "name", "seam", "required_controls")
    show_change_link = True


@admin.register(Part)
class PartAdmin(admin.ModelAdmin):
    list_display = ("number", "name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("number", "name")
    inlines = [SeamInline, OperationInline]


@admin.register(SeamSpec)
class SeamSpecAdmin(admin.ModelAdmin):
    list_display = ("part", "number", "joint_type", "material_1", "thickness_1", "seam_type")
    list_filter = ("seam_type",)
    search_fields = ("part__number", "number")
    list_select_related = ("part", "material_1")


@admin.register(Operation)
class OperationAdmin(admin.ModelAdmin):
    list_display = ("part", "number", "name", "seam", "order")
    search_fields = ("part__number", "number", "name")
    list_select_related = ("part", "seam")
