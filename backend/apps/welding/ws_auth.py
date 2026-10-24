# ВНИМАНИЕ, ограничение для внешнего развёртывания.
# Адрес с ?token=... попадает в журналы сервера (Daphne, обратный прокси)
# вместе с токеном. Внутри заводской сети это допустимо. Для внешнего
# развёртывания токен в адресе надо заменить на одноразовый пропуск:
# короткоживущий ключ, который выдаёт API и который гаснет после
# первого подключения.
#
# Вход в WebSocket по токену портала.
#
# Зачем это нужно. Портал входит по токену: браузер кладёт его
# в заголовок Authorization каждого запроса. Стандартный
# AuthMiddlewareStack у Channels ищет пользователя в сессионной cookie
# Django, а её при входе по токену никто не ставит — поэтому любой
# пользователь получал бы закрытие с кодом 4001.
#
# Заголовки у WebSocket из браузера задать нельзя, поэтому токен
# передаётся в адресе: /ws/telemetry/?token=... Проверка та же самая,
# что у обычного API: ищем токен в таблице токенов DRF.

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def user_by_token(key: str):
    # импорт внутри функции: модели готовы только после запуска Django
    from rest_framework.authtoken.models import Token

    token = Token.objects.select_related("user").filter(key=key).first()
    if token is None or not token.user.is_active:
        return AnonymousUser()
    return token.user


class TokenAuthMiddleware(BaseMiddleware):
    """Кладёт в соединение пользователя по ?token=, если он есть.

    Если токена в адресе нет, ничего не трогает: пользователя
    тогда найдёт обычная проверка по cookie (вход через админку).
    """

    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        key = (query.get("token") or [""])[0]
        if key:
            scope["user"] = await user_by_token(key)
        return await super().__call__(scope, receive, send)
