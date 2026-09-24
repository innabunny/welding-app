from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


class UserAdmin(BaseUserAdmin):
    # колонки в СПИСКЕ пользователей
    list_display = ('username', 'name', 'role', 'workshop', 'is_active')
    list_filter = ('role', 'is_active', 'workshop')

    # форма РЕДАКТИРОВАНИЯ — только нужное
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Портал', {'fields': ('name', 'role', 'workshop', 'is_active')}),
        ('Доступ в админку', {
            'classes': ('collapse',),          # свёрнуто, чтоб не мешалось
            'fields': ('is_staff', 'is_superuser'),
        }),
    )

    # форма СОЗДАНИЯ нового юзера
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'password1', 'password2', 'name', 'role', 'workshop'),
        }),
    )


admin.site.register(User, UserAdmin)