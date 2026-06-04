from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from appointments.models import Appointment
from clients.models import Client
from payments.models import Payment
from .models import Clinic, ClinicMembership, IntakeResponse, IntakeTemplate, Service, UserProfile
from .serializers import (
    ClinicSerializer,
    IntakeResponseSerializer,
    IntakeTemplateSerializer,
    PublicBookingSerializer,
    RegisterSerializer,
    ServiceSerializer,
    UserProfileSerializer,
)
from .utils import ensure_clinic_defaults, get_default_clinic


class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                },
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=201,
        )


class UserProfileView(APIView):
    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        return Response(UserProfileSerializer(profile).data)


class ClinicDetailView(APIView):
    def get(self, request):
        clinic = get_default_clinic(request.user)
        ensure_clinic_defaults(clinic)
        return Response(ClinicSerializer(clinic).data)

    def patch(self, request):
        clinic = get_default_clinic(request.user)
        serializer = ClinicSerializer(clinic, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ServiceListView(APIView):
    def get(self, request):
        clinic = get_default_clinic(request.user)
        ensure_clinic_defaults(clinic)
        return Response(ServiceSerializer(clinic.services.all(), many=True).data)


class IntakeResponseListView(APIView):
    def get(self, request):
        clinic = get_default_clinic(request.user)
        responses = IntakeResponse.objects.select_related("client", "appointment", "template").filter(clinic=clinic)
        return Response(IntakeResponseSerializer(responses, many=True).data)


class PublicClinicView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, clinic_slug):
        clinic = get_object_or_404(Clinic, slug=clinic_slug)
        ensure_clinic_defaults(clinic)
        return Response(ClinicSerializer(clinic).data)


class PublicAvailabilityView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, clinic_slug):
        clinic = get_object_or_404(Clinic, slug=clinic_slug)
        booked = Appointment.objects.filter(clinic=clinic).values("date", "time", "duration_minutes", "status")
        return Response(
            {
                "clinic": ClinicSerializer(clinic).data,
                "available_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "available_times": ["09:00", "10:30", "12:00", "14:00", "15:30"],
                "booked": list(booked),
            }
        )


class PublicBookingView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, clinic_slug):
        clinic = get_object_or_404(Clinic, slug=clinic_slug)
        serializer = PublicBookingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        service = get_object_or_404(Service, clinic=clinic, id=data["service_id"], is_active=True)
        owner = clinic.owner
        client, _ = Client.objects.get_or_create(
            clinic=clinic,
            owner=owner,
            email=data["email"],
            defaults={
                "first_name": data["first_name"],
                "last_name": data["last_name"],
                "phone": data.get("phone", ""),
            },
        )
        client.first_name = data["first_name"]
        client.last_name = data["last_name"]
        client.phone = data.get("phone", "")
        client.save(update_fields=["first_name", "last_name", "phone", "updated_at"])

        appointment = Appointment.objects.create(
            owner=owner,
            clinic=clinic,
            client=client,
            service_ref=service,
            service=service.name,
            date=data["date"],
            time=data["time"],
            duration_minutes=service.duration_minutes,
            status=Appointment.Status.PENDING,
            notes="Booked online by client.",
        )
        template = IntakeTemplate.objects.filter(clinic=clinic, is_active=True).first()
        intake = IntakeResponse.objects.create(
            clinic=clinic,
            template=template,
            client=client,
            appointment=appointment,
            health_history=data.get("health_history", ""),
            consent_accepted=data["consent_accepted"],
            answers={"source": "online_booking"},
        )
        payment = None
        if clinic.deposit_required and data.get("pay_deposit"):
            payment = Payment.objects.create(
                owner=owner,
                clinic=clinic,
                client=client,
                amount_cents=clinic.deposit_amount_cents,
                status=Payment.Status.UNPAID,
            )

        return Response(
            {
                "appointment_id": appointment.id,
                "client_id": client.id,
                "intake_id": intake.id,
                "payment_id": payment.id if payment else None,
                "status": appointment.status,
                "message": "Appointment request received. The clinic will confirm by email or SMS.",
            },
            status=status.HTTP_201_CREATED,
        )
