from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import Clinic, ClinicMembership, IntakeResponse, IntakeTemplate, Service, UserProfile
from .utils import ensure_clinic_defaults

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=UserProfile.Role.choices, default=UserProfile.Role.CLINIC_OWNER)
    clinic_name = serializers.CharField(max_length=160, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["id", "email", "password", "first_name", "last_name", "role", "clinic_name"]
        read_only_fields = ["id"]

    def validate_email(self, value: str) -> str:
        normalized = value.lower().strip()
        if User.objects.filter(email=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized

    @transaction.atomic
    def create(self, validated_data):
        role = validated_data.pop("role")
        clinic_name = validated_data.pop("clinic_name", "")
        password = validated_data.pop("password")
        email = validated_data.pop("email")
        user = User.objects.create_user(username=email, email=email, password=password, **validated_data)
        UserProfile.objects.create(user=user, role=role, clinic_name=clinic_name)
        clinic = Clinic.objects.create(owner=user, name=clinic_name or f"{user.first_name or email} Clinic")
        ClinicMembership.objects.create(user=user, clinic=clinic, role=ClinicMembership.Role.OWNER)
        ensure_clinic_defaults(clinic)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)

    class Meta:
        model = UserProfile
        fields = ["email", "first_name", "last_name", "role", "clinic_name", "phone_number"]


class ServiceSerializer(serializers.ModelSerializer):
    price = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = ["id", "name", "description", "duration_minutes", "price_cents", "price", "is_active"]

    def get_price(self, obj: Service) -> str:
        return f"{obj.price_cents / 100:.2f}"


class IntakeTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntakeTemplate
        fields = ["id", "name", "description", "is_active"]


class IntakeResponseSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()

    class Meta:
        model = IntakeResponse
        fields = [
            "id",
            "template",
            "client",
            "client_name",
            "appointment",
            "health_history",
            "consent_accepted",
            "answers",
            "created_at",
        ]
        read_only_fields = ["id", "client_name", "created_at"]

    def get_client_name(self, obj: IntakeResponse) -> str:
        return str(obj.client)


class ClinicSerializer(serializers.ModelSerializer):
    services = ServiceSerializer(many=True, read_only=True)
    intake_templates = IntakeTemplateSerializer(many=True, read_only=True)
    booking_url = serializers.SerializerMethodField()
    app_url = serializers.SerializerMethodField()

    class Meta:
        model = Clinic
        fields = [
            "id",
            "name",
            "slug",
            "public_email",
            "public_phone",
            "address",
            "booking_policy",
            "cancellation_window_hours",
            "deposit_required",
            "deposit_amount_cents",
            "reminders_enabled",
            "services",
            "intake_templates",
            "booking_url",
            "app_url",
        ]
        read_only_fields = ["id", "slug", "services", "intake_templates", "booking_url", "app_url"]

    def get_booking_url(self, obj: Clinic) -> str:
        return f"/book/{obj.slug}"

    def get_app_url(self, obj: Clinic) -> str:
        return f"/app/{obj.slug}"


class PublicBookingSerializer(serializers.Serializer):
    service_id = serializers.IntegerField()
    date = serializers.DateField()
    time = serializers.TimeField()
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    health_history = serializers.CharField(required=False, allow_blank=True)
    consent_accepted = serializers.BooleanField()
    pay_deposit = serializers.BooleanField(default=False)

    def validate_consent_accepted(self, value):
        if not value:
            raise serializers.ValidationError("Consent is required to book online.")
        return value
