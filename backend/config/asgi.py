
import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# ВАЖНО: приложение Django создаётся ДО импорта маршрутов.
# Иначе модели ещё не готовы, и импорт в consumers.py упадёт
django_asgi_app = get_asgi_application()

from apps.welding.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # AuthMiddlewareStack кладёт в соединение пользователя из сессии —
        # то же самое, что request.user в обычном Django
        "websocket": AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    }
)