# Маршруты WebSocket — то же, что urls.py, только для долгих соединений.

from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    # панель одного аппарата: /ws/telemetry/node-01/
    # Символы — как у имени узла в модели (apps/equipment/validators.py).
    # Не \w: он пропускает кириллицу, и группа Channels упала бы при подключении
    re_path(
        r"^ws/telemetry/(?P<node>[A-Za-z0-9][A-Za-z0-9.-]*)/$",
        consumers.TelemetryConsumer.as_asgi(),
    ),
    # общая панель цеха: все аппараты сразу
    re_path(r"^ws/telemetry/$", consumers.OverviewConsumer.as_asgi()),
]