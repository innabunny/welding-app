from django.contrib import admin
from .models import Material, MaterialGroup,  GasFlux, FillerMaterial, MaterialPair


@admin.register(GasFlux)
class GasFluxAdmin(admin.ModelAdmin):
    list_display = ('value', 'kind')
    list_filter = ('kind',)
    search_fields = ('value',)


@admin.register(FillerMaterial)
class FillerMaterialAdmin(admin.ModelAdmin):
    list_display = ('marka', 'kind', 'diameter')
    list_filter = ('kind',)
    search_fields = ('marka',)

@admin.register(MaterialGroup)
class MaterialGroupAdmin(admin.ModelAdmin):
    list_display = ('code',)
    search_fields = ('code',)

@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ('marka', 'group', 'tensile_strength')
    list_filter = ('group',)
    search_fields = ('marka',)
    filter_horizontal = ('analogs',)

@admin.register(MaterialPair)
class MaterialPairAdmin(admin.ModelAdmin):
    list_display = ('material_1', 'material_2')
    list_filter = ('material_1',)
    filter_horizontal = ('fillers', 'fluxes')
    autocomplete_fields = ('material_1', 'material_2')