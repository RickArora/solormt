from rest_framework import serializers

from core.utils import get_default_clinic
from clients.models import Client
from core.models import Practitioner
from .models import Appointment


class AppointmentSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()
    practitioner_name = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            "id",
            "client",
            "client_name",
            "practitioner",
            "practitioner_name",
            "service",
            "date",
            "time",
            "duration_minutes",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "client_name", "practitioner_name", "created_at", "updated_at"]

    def validate_client(self, client: Client) -> Client:
        request = self.context["request"]
        if client.owner_id != request.user.id or client.clinic_id != get_default_clinic(request.user).id:
            raise serializers.ValidationError("Client does not belong to this account.")
        return client

    def get_client_name(self, obj: Appointment) -> str:
        return str(obj.client)

    def validate_practitioner(self, practitioner: Practitioner | None) -> Practitioner | None:
        if not practitioner:
            return practitioner
        request = self.context["request"]
        if practitioner.clinic_id != get_default_clinic(request.user).id:
            raise serializers.ValidationError("Practitioner does not belong to this clinic.")
        return practitioner

    def get_practitioner_name(self, obj: Appointment) -> str:
        return obj.practitioner.name if obj.practitioner else ""
