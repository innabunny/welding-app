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
