from django.db.models import Count
from rest_framework import viewsets

from .models import Section, Workshop, Workstation
from .serializers import (
    SectionSerializer,
    WorkshopDetailSerializer,
    WorkshopSerializer,
    WorkstationSerializer,
)


class WorkshopViewSet(viewsets.ModelViewSet):
    """Цеха."""

    queryset = Workshop.objects.all()
    serializer_class = WorkshopSerializer

    def get_serializer_class(self):
        if self.action == "retrieve":
            return WorkshopDetailSerializer
        return WorkshopSerializer

    def get_queryset(self):
        # distinct=True обязателен: при нескольких связях сразу
        # база соединяет таблицы и цифры перемножаются между собой
        qs = super().get_queryset().annotate(
            welders_count=Count("welders", distinct=True),
            users_count=Count("users", distinct=True),
            sections_count=Count("sections", distinct=True),
        )
        if self.action == "retrieve":
            qs = qs.prefetch_related("sections")
        return qs


class SectionViewSet(viewsets.ModelViewSet):
    """Участки."""

    queryset = Section.objects.select_related("workshop")
    serializer_class = SectionSerializer

    def get_queryset(self):
        qs = super().get_queryset().annotate(
            workstations_count=Count("workstations", distinct=True),
        )
        workshop = self.request.query_params.get("workshop")
        if workshop:
            qs = qs.filter(workshop_id=workshop)
        return qs


class WorkstationViewSet(viewsets.ModelViewSet):
    """Рабочие места."""

    queryset = Workstation.objects.select_related("section", "section__workshop")
    serializer_class = WorkstationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        section = params.get("section")
        if section:
            qs = qs.filter(section_id=section)

        # посты всего цеха, через участки
        workshop = params.get("workshop")
        if workshop:
            qs = qs.filter(section__workshop_id=workshop)

        if params.get("active") == "1":
            qs = qs.filter(is_active=True)

        return qs