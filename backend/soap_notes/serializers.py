from rest_framework import serializers

from appointments.models import Appointment
from clients.models import Client
from .models import SoapNote


class SoapNoteSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()

    class Meta:
        model = SoapNote
        fields = [
            "id",
            "client",
            "client_name",
            "appointment",
            "subjective",
            "objective",
            "assessment",
            "plan",
            "is_complete",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "client_name", "created_at", "updated_at"]

    def get_client_name(self, obj: SoapNote) -> str:
        return str(obj.client)

    def validate_client(self, client: Client) -> Client:
        request = self.context["request"]
        if client.owner_id != request.user.id:
            raise serializers.ValidationError("Client does not belong to this account.")
        return client

    def validate_appointment(self, appointment: Appointment | None) -> Appointment | None:
        if appointment is None:
            return appointment
        request = self.context["request"]
        if appointment.owner_id != request.user.id:
            raise serializers.ValidationError("Appointment does not belong to this account.")
        return appointment

