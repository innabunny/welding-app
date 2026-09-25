# apps/equipment/views.py

from rest_framework import viewsets

from .models import Equipment, EquipmentParameter, SpeedUnit
from .serializers import (
    EquipmentDetailSerializer,
    EquipmentParameterSerializer,
    EquipmentSerializer,
    SpeedUnitSerializer,
)


class SpeedUnitViewSet(viewsets.ReadOnlyModelViewSet):
    """Только чтение: список и одна запись. Создавать и удалять
    единицы скорости через API незачем — это справочник из четырёх
    строк, его ведёт администратор."""

    queryset = SpeedUnit.objects.all()
    serializer_class = SpeedUnitSerializer


class EquipmentParameterViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = EquipmentParameter.objects.all()
    serializer_class = EquipmentParameterSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # параметры карты и параметры прохода нужны в разных местах формы
        level = self.request.query_params.get("level")
        if level:
            qs = qs.filter(level=level)
        return qs


class EquipmentViewSet(viewsets.ModelViewSet):
    """Установки."""

    # select_related — для связей «одна к одной стороне» (способ, цех),
    # prefetch_related — для многие-ко-многим. Без них Django полезет
    # в базу отдельно на каждую строку списка
    queryset = Equipment.objects.select_related("method", "workshop").prefetch_related(
        "speed_units", "parameters"
    )
    serializer_class = EquipmentSerializer

    def get_serializer_class(self):
        if self.action == "retrieve":
            return EquipmentDetailSerializer
        return EquipmentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        method = params.get("method")
        if method:
            qs = qs.filter(method_id=method)

        # все установки одного процесса: например, все TIG
        process = params.get("process")
        if process:
            qs = qs.filter(method__process=process)

        workshop = params.get("workshop")
        if workshop:
            qs = qs.filter(workshop_id=workshop)

        if params.get("active") == "1":
            qs = qs.filter(is_active=True)

        if params.get("has_pulse") == "1":
            qs = qs.filter(has_pulse=True)

        return qs