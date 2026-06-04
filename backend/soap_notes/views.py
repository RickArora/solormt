from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import SoapNote
from .serializers import SoapNoteSerializer


class SoapNoteViewSet(ModelViewSet):
    serializer_class = SoapNoteSerializer

    def get_queryset(self):
        return SoapNote.objects.select_related("client", "appointment").filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"], url_path="mark-complete")
    def mark_complete(self, request, pk=None):
        note = self.get_object()
        note.is_complete = True
        note.save(update_fields=["is_complete", "updated_at"])
        return Response(self.get_serializer(note).data)

