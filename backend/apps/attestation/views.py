from decimal import Decimal, InvalidOperation
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import AttestationRule, Attestation
from .serializers import AttestationRuleSerializer, AttestationSerializer


class AttestationRuleViewSet(viewsets.ModelViewSet):
    queryset = AttestationRule.objects.select_related("method", "group")
    serializer_class = AttestationRuleSerializer

    @action(detail=False, methods=["get"])
    def match(self, request):
        method = request.query_params.get("method")
        group = request.query_params.get("group")
        thickness = request.query_params.get("thickness")
        if not (method and group and thickness):
            return Response({"matched": False, "required_output": None}, status=400)
        try:
            t = Decimal(str(thickness))
        except InvalidOperation:
            return Response({"matched": False, "required_output": None}, status=400)
        rule = (
            self.get_queryset()
            .filter(method_id=method, group__code=group, is_active=True)
            .filter(th_from__lte=t)
            .filter(Q(th_to__gt=t) | Q(th_to__isnull=True))
            .first()
        )
        if not rule:
            return Response({"matched": False, "required_output": None})
        return Response(
            {
                "matched": True,
                "rule_id": rule.id,
                "required_output": rule.required_output,
            }
        )


class AttestationViewSet(viewsets.ModelViewSet):
    queryset = Attestation.objects.prefetch_related(
        "items", "items__wire", "items__flux", "items__gas"
    ).select_related("welder", "method", "group")
    
    serializer_class = AttestationSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != "draft":
            from rest_framework.response import Response
            from rest_framework import status

            return Response(
                {"detail": "Редактировать можно только черновик."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)