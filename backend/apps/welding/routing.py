# Маршруты WebSocket — то же, что urls.py, только для долгих соединений.

from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    # панель одного аппарата: /ws/telemetry/node-01/
    re_path(
        r"^ws/telemetry/(?P<node>[\w-]+)/$",
        consumers.TelemetryConsumer.as_asgi(),
    ),
    # общая панель цеха: все аппараты сразу
    re_path(r"^ws/telemetry/$", consumers.OverviewConsumer.as_asgi()),
]