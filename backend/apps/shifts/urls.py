from rest_framework.routers import DefaultRouter

from .views import CalendarExceptionViewSet, ShiftScheduleViewSet

router = DefaultRouter()
router.register("shift-schedules", ShiftScheduleViewSet, basename="shift-schedule")
router.register("calendar-exceptions", CalendarExceptionViewSet, basename="calendar-exception")

urlpatterns = router.urls