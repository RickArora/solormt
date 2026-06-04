from rest_framework.viewsets import ModelViewSet

from core.utils import get_default_clinic
from .models import Appointment
from .serializers import AppointmentSerializer


class AppointmentViewSet(ModelViewSet):
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        clinic = get_default_clinic(self.request.user)
        return Appointment.objects.select_related("client", "service_ref").filter(owner=self.request.user, clinic=clinic)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user, clinic=get_default_clinic(self.request.user))
