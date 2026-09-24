from rest_framework import permissions, viewsets
from .models import Welder
from .serializers import WelderSerializer


class IsAdminForWrite(permissions.BasePermission):
    SAFE = {'list', 'retrieve'}

    def has_permission(self, request, view):
        if view.action in self.SAFE:
            return True                    # смотреть — любому залогиненному (мастеру для аттестации)
        return getattr(request.user, 'role', None) == 'admin'   # менять — только админ


class WelderViewSet(viewsets.ModelViewSet):
    queryset = Welder.objects.select_related('workshop')
    serializer_class = WelderSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminForWrite]