from datetime import datetime, timedelta

import stripe
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from appointments.models import Appointment
from clients.models import Client
from payments.models import Payment
from appointments.serializers import AppointmentSerializer
from payments.serializers import PaymentSerializer
from .models import Clinic, ClinicMembership, IntakeResponse, IntakeTemplate, Practitioner, PractitionerAvailability, Service, UserProfile
from .serializers import (
    AppointmentReminderSerializer,
    ClientPortalAuthSerializer,
    ClinicSerializer,
    IntakeResponseSerializer,
    IntakeTemplateSerializer,
    PractitionerAvailabilitySerializer,
    PractitionerSerializer,
    PublicBookingSerializer,
    RegisterSerializer,
    ServiceSerializer,
    UserProfileSerializer,
)
from .utils import ensure_clinic_defaults, get_default_clinic, queue_appointment_reminders

User = get_user_model()


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


class PractitionerListView(APIView):
    def get(self, request):
        clinic = get_default_clinic(request.user)
        ensure_clinic_defaults(clinic)
        practitioners = clinic.practitioners.prefetch_related("services", "availability").all()
        return Response(PractitionerSerializer(practitioners, many=True).data)

    def post(self, request):
        clinic = get_default_clinic(request.user)
        serializer = PractitionerSerializer(data=request.data, context={"clinic": clinic})
        serializer.is_valid(raise_exception=True)
        practitioner = serializer.save(clinic=clinic)
        return Response(PractitionerSerializer(practitioner).data, status=status.HTTP_201_CREATED)


class PractitionerAvailabilityView(APIView):
    def post(self, request, practitioner_id):
        clinic = get_default_clinic(request.user)
        practitioner = get_object_or_404(Practitioner, id=practitioner_id, clinic=clinic)
        serializer = PractitionerAvailabilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        availability = serializer.save(practitioner=practitioner)
        return Response(PractitionerAvailabilitySerializer(availability).data, status=status.HTTP_201_CREATED)


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
        ensure_clinic_defaults(clinic)
        service_id = request.query_params.get("service_id")
        practitioner_id = request.query_params.get("practitioner_id")
        practitioners = clinic.practitioners.prefetch_related("services", "availability").filter(is_active=True)
        if service_id:
            practitioners = practitioners.filter(services__id=service_id).distinct()
        if practitioner_id:
            practitioners = practitioners.filter(id=practitioner_id)

        booked = Appointment.objects.filter(clinic=clinic).exclude(status=Appointment.Status.CANCELLED)
        if practitioner_id:
            booked = booked.filter(practitioner_id=practitioner_id)
        booked_keys = {(item.date.isoformat(), item.time.strftime("%H:%M"), item.practitioner_id) for item in booked}
        slots = []
        now = timezone.localdate()
        current_local_time = timezone.localtime().time()
        for day_offset in range(21):
            slot_date = now + timedelta(days=day_offset)
            for practitioner in practitioners:
                for window in practitioner.availability.filter(weekday=slot_date.weekday(), is_active=True):
                    current = datetime.combine(slot_date, window.start_time)
                    end = datetime.combine(slot_date, window.end_time)
                    while current < end:
                        time_value = current.time().strftime("%H:%M")
                        if slot_date == now and current.time() <= current_local_time:
                            current += timedelta(minutes=30)
                            continue
                        if (slot_date.isoformat(), time_value, practitioner.id) not in booked_keys:
                            slots.append(
                                {
                                    "date": slot_date.isoformat(),
                                    "time": time_value,
                                    "practitioner_id": practitioner.id,
                                    "practitioner_name": practitioner.name,
                                }
                            )
                        current += timedelta(minutes=30)
        return Response(
            {
                "clinic": ClinicSerializer(clinic).data,
                "practitioners": PractitionerSerializer(practitioners, many=True).data,
                "available_slots": slots[:120],
                "available_days": sorted({slot["date"] for slot in slots}),
                "available_times": sorted({slot["time"] for slot in slots}),
                "booked": list(booked.values("date", "time", "duration_minutes", "status", "practitioner_id")),
            }
        )


class PublicBookingView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, clinic_slug):
        clinic = get_object_or_404(Clinic, slug=clinic_slug)
        ensure_clinic_defaults(clinic)
        serializer = PublicBookingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        service = get_object_or_404(Service, clinic=clinic, id=data["service_id"], is_active=True)
        practitioner = get_object_or_404(
            Practitioner.objects.filter(clinic=clinic, is_active=True, services=service),
            id=data["practitioner_id"],
        )
        if Appointment.objects.filter(
            clinic=clinic,
            practitioner=practitioner,
            date=data["date"],
            time=data["time"],
        ).exclude(status=Appointment.Status.CANCELLED).exists():
            return Response({"detail": "That appointment time is no longer available."}, status=status.HTTP_409_CONFLICT)

        owner = clinic.owner
        email = data["email"].lower().strip()
        portal_user = None
        if data["auth_mode"] == "login":
            portal_user = authenticate(username=email, password=data["password"])
            if not portal_user:
                return Response({"detail": "Invalid client portal login."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            portal_user, created = User.objects.get_or_create(
                username=email,
                defaults={"email": email, "first_name": data["first_name"], "last_name": data["last_name"]},
            )
            if created:
                portal_user.set_password(data["password"])
                portal_user.save(update_fields=["password"])
                UserProfile.objects.create(user=portal_user, role=UserProfile.Role.CLIENT)
            elif not portal_user.check_password(data["password"]):
                return Response({"detail": "This email already has a client portal account. Please log in."}, status=status.HTTP_400_BAD_REQUEST)

        client, _ = Client.objects.get_or_create(
            clinic=clinic,
            owner=owner,
            email=email,
            defaults={
                "first_name": data["first_name"],
                "last_name": data["last_name"],
                "phone": data.get("phone", ""),
                "portal_user": portal_user,
            },
        )
        client.first_name = data["first_name"]
        client.last_name = data["last_name"]
        client.phone = data.get("phone", "")
        if portal_user and not client.portal_user_id:
            client.portal_user = portal_user
        client.save(update_fields=["first_name", "last_name", "phone", "portal_user", "updated_at"])

        appointment = Appointment.objects.create(
            owner=owner,
            clinic=clinic,
            client=client,
            service_ref=service,
            practitioner=practitioner,
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
            status=IntakeResponse.Status.COMPLETED if data.get("health_history") else IntakeResponse.Status.SENT,
            sent_at=timezone.now(),
            completed_at=timezone.now() if data.get("health_history") else None,
            answers={"source": "online_booking", "delivery": "client_portal"},
        )
        queue_appointment_reminders(appointment)
        payment = None
        checkout_url = ""
        payment_required = clinic.booking_payment_mode != Clinic.BookingPaymentMode.NONE or clinic.deposit_required or clinic.card_on_file_required
        if payment_required:
            amount_cents = clinic.deposit_amount_cents or service.price_cents
            if clinic.booking_payment_mode == Clinic.BookingPaymentMode.CARD_ON_FILE or clinic.card_on_file_required:
                amount_cents = 50
            payment = Payment.objects.create(
                owner=owner,
                clinic=clinic,
                client=client,
                appointment=appointment,
                kind=clinic.booking_payment_mode if clinic.booking_payment_mode != Clinic.BookingPaymentMode.NONE else Payment.Kind.DEPOSIT,
                provider=clinic.payment_provider,
                amount_cents=amount_cents,
                status=Payment.Status.UNPAID,
            )
            if clinic.payment_provider == Clinic.PaymentProvider.STRIPE and settings.STRIPE_SECRET_KEY:
                stripe.api_key = settings.STRIPE_SECRET_KEY
                if payment.kind == Payment.Kind.CARD_ON_FILE:
                    session = stripe.checkout.Session.create(
                        mode="setup",
                        payment_method_types=["card"],
                        customer_email=email,
                        success_url=settings.FRONTEND_SUCCESS_URL,
                        cancel_url=settings.FRONTEND_CANCEL_URL,
                        metadata={"payment_id": str(payment.id), "appointment_id": str(appointment.id)},
                    )
                else:
                    session = stripe.checkout.Session.create(
                        mode="payment",
                        payment_method_types=["card"],
                        customer_email=email,
                        line_items=[
                            {
                                "price_data": {
                                    "currency": "cad",
                                    "product_data": {"name": f"{service.name} booking requirement"},
                                    "unit_amount": amount_cents,
                                },
                                "quantity": 1,
                            }
                        ],
                        success_url=settings.FRONTEND_SUCCESS_URL,
                        cancel_url=settings.FRONTEND_CANCEL_URL,
                        metadata={"payment_id": str(payment.id), "appointment_id": str(appointment.id)},
                    )
                payment.amount_cents = amount_cents
                payment.stripe_checkout_session_id = session.id
                payment.checkout_url = session.url or ""
                payment.save(update_fields=["amount_cents", "stripe_checkout_session_id", "checkout_url", "updated_at"])
                checkout_url = payment.checkout_url
        refresh = RefreshToken.for_user(portal_user) if portal_user else None

        return Response(
            {
                "appointment_id": appointment.id,
                "client_id": client.id,
                "intake_id": intake.id,
                "payment_id": payment.id if payment else None,
                "payment_required": payment_required,
                "checkout_url": checkout_url,
                "client_access": str(refresh.access_token) if refresh else "",
                "client_refresh": str(refresh) if refresh else "",
                "status": appointment.status,
                "message": "Appointment request received. Intake and reminder records were queued for the client portal.",
            },
            status=status.HTTP_201_CREATED,
        )


class ClientPortalAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, clinic_slug):
        clinic = get_object_or_404(Clinic, slug=clinic_slug)
        serializer = ClientPortalAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        email = data["email"].lower().strip()
        if data["mode"] == "login":
            user = authenticate(username=email, password=data["password"])
            if not user:
                return Response({"detail": "Invalid email or password."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            user, created = User.objects.get_or_create(
                username=email,
                defaults={
                    "email": email,
                    "first_name": data.get("first_name", ""),
                    "last_name": data.get("last_name", ""),
                },
            )
            if created:
                user.set_password(data["password"])
                user.save(update_fields=["password"])
                UserProfile.objects.create(user=user, role=UserProfile.Role.CLIENT)
            elif not user.check_password(data["password"]):
                return Response({"detail": "This account already exists. Please log in."}, status=status.HTTP_400_BAD_REQUEST)

        client, _ = Client.objects.get_or_create(
            clinic=clinic,
            owner=clinic.owner,
            email=email,
            defaults={
                "first_name": data.get("first_name") or user.first_name,
                "last_name": data.get("last_name") or user.last_name,
                "phone": data.get("phone", ""),
                "portal_user": user,
            },
        )
        if not client.portal_user_id:
            client.portal_user = user
            client.save(update_fields=["portal_user", "updated_at"])
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "client_id": client.id,
                "clinic": ClinicSerializer(clinic).data,
            }
        )


class ClientPortalView(APIView):
    def get(self, request, clinic_slug):
        clinic = get_object_or_404(Clinic, slug=clinic_slug)
        client = get_object_or_404(Client, clinic=clinic, portal_user=request.user)
        appointments = Appointment.objects.select_related("client", "practitioner", "service_ref").filter(clinic=clinic, client=client)
        intakes = IntakeResponse.objects.filter(clinic=clinic, client=client)
        payments = Payment.objects.filter(clinic=clinic, client=client)
        return Response(
            {
                "clinic": ClinicSerializer(clinic).data,
                "client": {"id": client.id, "name": str(client), "email": client.email, "phone": client.phone},
                "appointments": AppointmentSerializer(appointments, many=True, context={"request": request}).data,
                "intake_responses": IntakeResponseSerializer(intakes, many=True).data,
                "payments": PaymentSerializer(payments, many=True, context={"request": request}).data,
            }
        )


class ClientAppointmentActionView(APIView):
    def post(self, request, clinic_slug, appointment_id, action):
        clinic = get_object_or_404(Clinic, slug=clinic_slug)
        client = get_object_or_404(Client, clinic=clinic, portal_user=request.user)
        appointment = get_object_or_404(Appointment, id=appointment_id, clinic=clinic, client=client)
        start_at = timezone.make_aware(datetime.combine(appointment.date, appointment.time))
        if start_at - timezone.now() < timedelta(hours=clinic.cancellation_window_hours):
            return Response(
                {"detail": f"Changes require at least {clinic.cancellation_window_hours} hours notice."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if action == "cancel":
            appointment.status = Appointment.Status.CANCELLED
            appointment.save(update_fields=["status", "updated_at"])
            appointment.reminders.update(status="cancelled")
        elif action == "reschedule":
            if request.data.get("date"):
                appointment.date = datetime.strptime(request.data["date"], "%Y-%m-%d").date()
            if request.data.get("time"):
                appointment.time = datetime.strptime(request.data["time"], "%H:%M").time()
            appointment.status = Appointment.Status.PENDING
            appointment.save(update_fields=["date", "time", "status", "updated_at"])
            appointment.reminders.update(status="cancelled")
            queue_appointment_reminders(appointment)
        else:
            return Response({"detail": "Unknown action."}, status=status.HTTP_404_NOT_FOUND)
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)
