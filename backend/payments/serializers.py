from rest_framework import serializers

from clients.models import Client
from core.utils import get_default_clinic
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()
    amount = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "client",
            "client_name",
            "stripe_payment_id",
            "stripe_checkout_session_id",
            "amount_cents",
            "amount",
            "currency",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "client_name", "amount", "created_at", "updated_at"]

    def get_client_name(self, obj: Payment) -> str:
        return str(obj.client)

    def get_amount(self, obj: Payment) -> str:
        return f"{obj.amount_cents / 100:.2f}"

    def validate_client(self, client: Client) -> Client:
        request = self.context["request"]
        if client.owner_id != request.user.id or client.clinic_id != get_default_clinic(request.user).id:
            raise serializers.ValidationError("Client does not belong to this account.")
        return client


class CheckoutSerializer(serializers.Serializer):
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all())
    amount_cents = serializers.IntegerField(min_value=50)
    description = serializers.CharField(max_length=255, default="Massage therapy appointment")

    def validate_client(self, client: Client) -> Client:
        request = self.context["request"]
        if client.owner_id != request.user.id or client.clinic_id != get_default_clinic(request.user).id:
            raise serializers.ValidationError("Client does not belong to this account.")
        return client
