from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import (
    AppointmentReminder,
    Clinic,
    ClinicMembership,
    ClientPackage,
    IntakeResponse,
    IntakeTemplate,
    Package,
    Practitioner,
    PractitionerAvailability,
    Service,
    UserProfile,
    WaitlistEntry,
)
from .security import validate_strong_password, verify_recaptcha
from .utils import ensure_clinic_defaults

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    recaptcha_token = serializers.CharField(write_only=True, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=UserProfile.Role.choices, default=UserProfile.Role.CLINIC_OWNER)
    clinic_name = serializers.CharField(max_length=160, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["id", "email", "password", "first_name", "last_name", "role", "clinic_name", "recaptcha_token"]
        read_only_fields = ["id"]

    def validate_email(self, value: str) -> str:
        normalized = value.lower().strip()
        if User.objects.filter(email=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized

    def validate_password(self, value: str) -> str:
        validate_strong_password(value)
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        verify_recaptcha(attrs.pop("recaptcha_token", ""), request.META.get("REMOTE_ADDR", "") if request else "")
        return attrs

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
        fields = ["id", "name", "description", "duration_minutes", "price_cents", "price", "is_active", "requires_intake"]

    def get_price(self, obj: Service) -> str:
        return f"{obj.price_cents / 100:.2f}"


class PractitionerAvailabilitySerializer(serializers.ModelSerializer):
    weekday_label = serializers.CharField(source="get_weekday_display", read_only=True)

    class Meta:
        model = PractitionerAvailability
        fields = ["id", "weekday", "weekday_label", "start_time", "end_time", "is_active"]
        read_only_fields = ["id", "weekday_label"]


class PractitionerSerializer(serializers.ModelSerializer):
    availability = PractitionerAvailabilitySerializer(many=True, read_only=True)
    service_ids = serializers.PrimaryKeyRelatedField(
        source="services",
        queryset=Service.objects.all(),
        many=True,
        required=False,
        write_only=True,
    )
    services = ServiceSerializer(many=True, read_only=True)
    name = serializers.CharField(read_only=True)

    class Meta:
        model = Practitioner
        fields = [
            "id",
            "first_name",
            "last_name",
            "display_name",
            "name",
            "email",
            "phone",
            "bio",
            "services",
            "service_ids",
            "availability",
            "is_active",
            "slot_duration_minutes",
            "buffer_minutes",
            "slot_duration_options",
        ]
        read_only_fields = ["id", "name", "services", "availability"]

    def validate_service_ids(self, services):
        clinic = self.context.get("clinic")
        if clinic and any(service.clinic_id != clinic.id for service in services):
            raise serializers.ValidationError("Services must belong to this clinic.")
        return services


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
            "status",
            "answers",
            "sent_at",
            "reminder_sent_at",
            "completed_at",
            "created_at",
        ]
        read_only_fields = ["id", "client_name", "sent_at", "reminder_sent_at", "completed_at", "created_at"]

    def get_client_name(self, obj: IntakeResponse) -> str:
        return str(obj.client)


class ClinicSerializer(serializers.ModelSerializer):
    services = ServiceSerializer(many=True, read_only=True)
    practitioners = PractitionerSerializer(many=True, read_only=True)
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
            "payment_provider",
            "booking_payment_mode",
            "card_on_file_required",
            "reminders_enabled",
            "reminder_email",
            "sms_enabled",
            "noshow_protection_enabled",
            "noshow_fee_cents",
            "services",
            "practitioners",
            "intake_templates",
            "booking_url",
            "app_url",
        ]
        read_only_fields = ["id", "slug", "services", "practitioners", "intake_templates", "booking_url", "app_url"]

    def get_booking_url(self, obj: Clinic) -> str:
        return f"/book/{obj.slug}"

    def get_app_url(self, obj: Clinic) -> str:
        return f"/app/{obj.slug}"


class PublicBookingSerializer(serializers.Serializer):
    auth_mode = serializers.ChoiceField(choices=["register", "login"], default="register")
    service_id = serializers.IntegerField()
    practitioner_id = serializers.IntegerField()
    date = serializers.DateField()
    time = serializers.TimeField()
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    recaptcha_token = serializers.CharField(write_only=True, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    health_history = serializers.CharField(required=False, allow_blank=True)
    consent_accepted = serializers.BooleanField()
    pay_deposit = serializers.BooleanField(default=False)
    save_card = serializers.BooleanField(default=False)
    sms_opt_in = serializers.BooleanField(default=False)

    def validate_consent_accepted(self, value):
        if not value:
            raise serializers.ValidationError("Consent is required to book online.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        verify_recaptcha(attrs.pop("recaptcha_token", ""), request.META.get("REMOTE_ADDR", "") if request else "")
        if attrs.get("auth_mode") == "register":
            validate_strong_password(attrs["password"])
        return attrs


class ClientPortalAuthSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["register", "login"])
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8)
    recaptcha_token = serializers.CharField(write_only=True, required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context.get("request")
        verify_recaptcha(attrs.pop("recaptcha_token", ""), request.META.get("REMOTE_ADDR", "") if request else "")
        if attrs.get("mode") == "register":
            validate_strong_password(attrs["password"])
        return attrs


class AppointmentReminderSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    channel_label = serializers.CharField(source="get_channel_display", read_only=True)

    class Meta:
        model = AppointmentReminder
        fields = ["id", "kind", "kind_label", "channel", "channel_label", "status", "scheduled_for", "message"]


class WaitlistEntrySerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()
    service_name = serializers.CharField(source="service.name", read_only=True)
    practitioner_name = serializers.SerializerMethodField()

    class Meta:
        model = WaitlistEntry
        fields = [
            "id", "client", "client_name", "service", "service_name",
            "practitioner", "practitioner_name", "preferred_date",
            "notes", "status", "notified_at", "created_at",
        ]
        read_only_fields = ["id", "client_name", "service_name", "practitioner_name", "notified_at", "created_at"]

    def get_client_name(self, obj: WaitlistEntry) -> str:
        return str(obj.client)

    def get_practitioner_name(self, obj: WaitlistEntry) -> str:
        return str(obj.practitioner) if obj.practitioner else ""


class PackageSerializer(serializers.ModelSerializer):
    price = serializers.SerializerMethodField()
    service_name = serializers.CharField(source="service.name", read_only=True)

    class Meta:
        model = Package
        fields = [
            "id", "name", "description", "service", "service_name",
            "sessions", "validity_days", "price_cents", "price", "is_active", "created_at",
        ]
        read_only_fields = ["id", "price", "service_name", "created_at"]

    def get_price(self, obj: Package) -> str:
        return f"{obj.price_cents / 100:.2f}"


class ClientPackageSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()
    sessions_remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = ClientPackage
        fields = [
            "id", "client", "client_name", "package", "package_name",
            "sessions_total", "sessions_used", "sessions_remaining",
            "price_cents", "status", "purchased_at", "expires_at",
        ]
        read_only_fields = [
            "id", "client_name", "package_name", "sessions_total",
            "price_cents", "sessions_remaining", "purchased_at",
        ]

    def get_client_name(self, obj: ClientPackage) -> str:
        return str(obj.client)
