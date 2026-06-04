from rest_framework.viewsets import ModelViewSet

from core.utils import get_default_clinic
from .models import Client
from .serializers import ClientSerializer


class ClientViewSet(ModelViewSet):
    serializer_class = ClientSerializer

    def get_queryset(self):
        clinic = get_default_clinic(self.request.user)
        return Client.objects.filter(owner=self.request.user, clinic=clinic)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user, clinic=get_default_clinic(self.request.user))
