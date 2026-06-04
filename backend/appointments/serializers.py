from rest_framework import serializers

from clients.models import Client
from .models import Appointment


class AppointmentSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            "id",
            "client",
            "client_name",
            "service",
            "date",
            "time",
            "duration_minutes",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "client_name", "created_at", "updated_at"]

    def validate_client(self, client: Client) -> Client:
        request = self.context["request"]
        if client.owner_id != request.user.id:
            raise serializers.ValidationError("Client does not belong to this account.")
        return client

    def get_client_name(self, obj: Appointment) -> str:
        return str(obj.client)
