from django.contrib import admin
from .models import Welder


@admin.register(Welder)
class WelderAdmin(admin.ModelAdmin):
    list_display = ('fio', 'workshop', 'rank', 'education', 'age', 'experience_years', 'is_active')
    list_filter = ('workshop', 'is_active')
    search_fields = ('fio',)
