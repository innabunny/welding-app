from datetime import date

from django.contrib import admin
from django.utils.html import format_html

from apps.attestation.models import Attestation

from .models import Welder


class AttestationInline(admin.TabularInline):
    """Допуски прямо в карточке сварщика: видно, на что аттестован,
    не переходя в другой раздел."""

    model = Attestation
    extra = 0
    fields = ("method", "group", "kind", "status", "attested_at", "valid_until")
    readonly_fields = ("valid_until",)  # считается в save() модели
    show_change_link = True             # ссылка на полную карточку аттестации


@admin.register(Welder)
class WelderAdmin(admin.ModelAdmin):
    list_display = (
        "fio",
        "personnel_no",
        "workshop",
        "rank",
        "experience_years",
        "attestation_state",
        "has_card",
        "is_active",
    )
    list_filter = ("workshop", "is_active", "rank")
    list_select_related = ("workshop",)
    search_fields = ("fio", "personnel_no", "rfid_uid")
    ordering = ("fio",)
    inlines = (AttestationInline,)

    fieldsets = (
        ("Личные данные", {
            "fields": ("fio", "personnel_no", "birth_date", "education"),
        }),
        ("Работа", {
            "fields": ("workshop", "rank", "welding_since", "is_active"),
        }),
        ("Допуск на рабочее место", {
            "description": (
                "UID карты EM-Marine в hex, нижним регистром. "
                "Печатный номер на карте — тот же UID в десятичном виде "
                "с нулями до 10 знаков."
            ),
            "fields": ("rfid_uid",),
        }),
    )

    def get_queryset(self, request):
        # допуски понадобятся в колонке состояния — тянем их сразу,
        # иначе запрос на каждую строку списка
        return super().get_queryset(request).prefetch_related("attestations")

    @admin.display(description="Стаж, лет")
    def experience_years(self, obj):
        return obj.experience_years or "—"

    @admin.display(description="Допуск")
    def attestation_state(self, obj):
        """Худшее состояние срока по всем действующим аттестациям."""
        states = [
            a.expiry_state for a in obj.attestations.all() if a.status == "done"
        ]
        if not states:
            return format_html('<span style="color:#888">нет</span>')

        if "expired" in states:
            return format_html('<span style="color:#b34242">просрочен</span>')
        if "soon" in states:
            return format_html('<span style="color:#a8701c">истекает</span>')
        return format_html('<span style="color:#24785a">действует</span>')

    @admin.display(description="Карта", boolean=True)
    def has_card(self, obj):
        """Галочка, если RFID-карта привязана."""
        return bool(obj.rfid_uid)