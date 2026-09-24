from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate as django_authenticate
from rest_framework.permissions import IsAuthenticated

from .models import User
from .serializers import UserSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(is_superuser=False)
    serializer_class = UserSerializer


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    login = request.data.get("login")
    password = request.data.get("password")

    if not login or not password:
        return Response(
            {"detail": "Введите логин и пароль"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = django_authenticate(username=login, password=password)
    if user is None:
        return Response(
            {"detail": "Неверный логин или пароль"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_active:
        return Response(
            {"detail": "Учётная запись отключена"},
            status=status.HTTP_403_FORBIDDEN,
        )

    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {
            "token": token.key,
            "user": UserSerializer(user).data,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    request.user.auth_token.delete()
    return Response(status=204)