from rest_framework import permissions

# Технолог отвечает на производстве за детали, операции и справочники
# материалов, поэтому правит их наравне с администратором
TECHNOLOGY_EDITORS = ("admin", "technologist")


class IsTechnologyEditor(permissions.BasePermission):
    """Читают все вошедшие, добавляют и правят — администратор и технолог."""

    message = "Изменять могут только администратор и технолог"

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return getattr(request.user, "role", None) in TECHNOLOGY_EDITORS


# аттестацию ведут технолог и мастер: мастер знает людей на участке
ATTESTATION_EDITORS = ("admin", "technologist", "master")


class IsAttestationEditor(permissions.BasePermission):
    """Читают все вошедшие, аттестации и сварщиков правят администратор, технолог и мастер."""

    message = "Изменять могут только администратор, технолог и мастер"

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return getattr(request.user, "role", None) in ATTESTATION_EDITORS


# Решения по отклонениям — подпись под судьбой шва. Отклонения режима
# решает технолог, нарушения порядка (без карты, без допуска) разбирает
# мастер. Какое решение какой роли доступно, проверяет сериализатор
# решения: здесь только кто вообще может подписывать
DECISION_AUTHORS = ("admin", "technologist", "master")


class IsDecisionAuthor(permissions.BasePermission):
    """Читают все вошедшие. Создают администратор, технолог и мастер.

    Править и удалять подписанное решение — только администратор
    и технолог: мастер не должен иметь возможности стереть решение
    технолога.
    """

    message = "Ставить решения по отклонениям могут администратор, технолог и мастер"

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        role = getattr(request.user, "role", None)
        if request.method == "POST":
            return role in DECISION_AUTHORS
        return role in TECHNOLOGY_EDITORS
