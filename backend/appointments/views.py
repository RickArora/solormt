from rest_framework.viewsets import ModelViewSet

from .models import Appointment
from .serializers import AppointmentSerializer


class AppointmentViewSet(ModelViewSet):
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        return Appointment.objects.select_related("client").filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

