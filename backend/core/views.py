from datetime import datetime, timedelta

import stripe
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """JWT login with brute-force throttling (the 'auth' scope)."""
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

from datetime import date as date_type

from appointments.models import Appointment
from clients.models import Client
from payments.models import InsuranceClaim, Payment
from appointments.serializers import AppointmentSerializer
from payments.serializers import InsuranceClaimSerializer, PaymentSerializer
from .models import (
    AppointmentReminder, Clinic, ClinicMembership, ClientPackage, IntakeResponse, IntakeTemplate,
    Package, PasswordResetToken, Practitioner, PractitionerAvailability, Service, UserProfile, WaitlistEntry,
)
from .serializers import (
    AppointmentReminderSerializer,
    ClientPackageSerializer,
    ClientPortalAuthSerializer,
    ClinicSerializer,
    IntakeResponseSerializer,
    IntakeTemplateSerializer,
    PackageSerializer,
    PractitionerAvailabilitySerializer,
    PractitionerSerializer,
    PublicBookingSerializer,
    RegisterSerializer,
    ServiceSerializer,
    UserProfileSerializer,
    WaitlistEntrySerializer,
)
from .utils import ensure_clinic_defaults, get_default_clinic, notify_waitlist, queue_appointment_reminders, send_intake_request, send_password_reset_email

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"
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


class ServiceDetailView(APIView):
    def patch(self, request, service_id):
        clinic = get_default_clinic(request.user)
        service = get_object_or_404(Service, id=service_id, clinic=clinic)
        serializer = ServiceSerializer(service, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


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


class PractitionerDetailView(APIView):
    def patch(self, request, practitioner_id):
        clinic = get_default_clinic(request.user)
        practitioner = get_object_or_404(Practitioner, id=practitioner_id, clinic=clinic)
        serializer = PractitionerSerializer(practitioner, data=request.data, partial=True, context={"clinic": clinic})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(PractitionerSerializer(practitioner).data)

    def delete(self, request, practitioner_id):
        clinic = get_default_clinic(request.user)
        practitioner = get_object_or_404(Practitioner, id=practitioner_id, clinic=clinic)
        practitioner.is_active = False
        practitioner.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PractitionerAvailabilityView(APIView):
    def get(self, request, practitioner_id):
        clinic = get_default_clinic(request.user)
        practitioner = get_object_or_404(Practitioner, id=practitioner_id, clinic=clinic)
        return Response(PractitionerAvailabilitySerializer(practitioner.availability.all(), many=True).data)

    def post(self, request, practitioner_id):
        clinic = get_default_clinic(request.user)
        practitioner = get_object_or_404(Practitioner, id=practitioner_id, clinic=clinic)
        serializer = PractitionerAvailabilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        availability = serializer.save(practitioner=practitioner)
        return Response(PractitionerAvailabilitySerializer(availability).data, status=status.HTTP_201_CREATED)


class PractitionerAvailabilityDetailView(APIView):
    def delete(self, request, practitioner_id, availability_id):
        clinic = get_default_clinic(request.user)
        practitioner = get_object_or_404(Practitioner, id=practitioner_id, clinic=clinic)
        availability = get_object_or_404(PractitionerAvailability, id=availability_id, practitioner=practitioner)
        availability.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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

        # Horizon is configurable so the calendar can look far into the future.
        try:
            horizon_days = min(370, max(1, int(request.query_params.get("days", 60))))
        except (TypeError, ValueError):
            horizon_days = 60
        try:
            start_offset = max(0, int(request.query_params.get("start_offset", 0)))
        except (TypeError, ValueError):
            start_offset = 0

        slots = []
        now = timezone.localdate()
        current_local_time = timezone.localtime().time()
        for day_offset in range(start_offset, start_offset + horizon_days):
            slot_date = now + timedelta(days=day_offset)
            for practitioner in practitioners:
                step = max(5, practitioner.slot_duration_minutes or 60)
                buffer_minutes = practitioner.buffer_minutes or 0
                for window in practitioner.availability.filter(weekday=slot_date.weekday(), is_active=True):
                    current = datetime.combine(slot_date, window.start_time)
                    end = datetime.combine(slot_date, window.end_time)
                    while current + timedelta(minutes=step) <= end:
                        time_value = current.time().strftime("%H:%M")
                        if slot_date == now and current.time() <= current_local_time:
                            current += timedelta(minutes=step + buffer_minutes)
                            continue
                        if (slot_date.isoformat(), time_value, practitioner.id) not in booked_keys:
                            slots.append(
                                {
                                    "date": slot_date.isoformat(),
                                    "time": time_value,
                                    "practitioner_id": practitioner.id,
                                    "practitioner_name": practitioner.name,
                                    "duration_minutes": step,
                                }
                            )
                        current += timedelta(minutes=step + buffer_minutes)
        return Response(
            {
                "clinic": ClinicSerializer(clinic).data,
                "practitioners": PractitionerSerializer(practitioners, many=True).data,
                "available_slots": slots,
                "available_days": sorted({slot["date"] for slot in slots}),
                "available_times": sorted({slot["time"] for slot in slots}),
                "booked": list(booked.values("date", "time", "duration_minutes", "status", "practitioner_id")),
            }
        )


class PublicBookingView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_booking"

    def post(self, request, clinic_slug):
        clinic = get_object_or_404(Clinic, slug=clinic_slug)
        ensure_clinic_defaults(clinic)
        serializer = PublicBookingSerializer(data=request.data, context={"request": request})
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
        # SMS consent: opting in clears any prior opt-out.
        if data.get("sms_opt_in"):
            client.sms_opt_in = True
            client.sms_opt_out_at = None
        if portal_user and not client.portal_user_id:
            client.portal_user = portal_user
        client.save(update_fields=["first_name", "last_name", "phone", "sms_opt_in", "sms_opt_out_at", "portal_user", "updated_at"])

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
        provided_inline = bool(data.get("health_history"))
        intake = IntakeResponse.objects.create(
            clinic=clinic,
            template=template,
            client=client,
            appointment=appointment,
            health_history=data.get("health_history", ""),
            consent_accepted=data["consent_accepted"],
            status=IntakeResponse.Status.COMPLETED if provided_inline else IntakeResponse.Status.SENT,
            sent_at=timezone.now(),
            # Emailed intake links are short-lived so a leaked URL can't expose PHI indefinitely.
            token_expires_at=timezone.now() + timedelta(days=14),
            completed_at=timezone.now() if provided_inline else None,
            answers={"source": "online_booking", "delivery": "client_portal"},
        )
        # Service-driven auto-send: if the booked service requires an intake form
        # and the client didn't complete it inline, email them a tokenized link.
        if not provided_inline and service.requires_intake:
            send_intake_request(intake)
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
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request, clinic_slug):
        clinic = get_object_or_404(Clinic, slug=clinic_slug)
        serializer = ClientPortalAuthSerializer(data=request.data, context={"request": request})
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
            # Notify anyone on the waitlist for this service
            if appointment.service_ref and appointment.clinic:
                notify_waitlist(appointment.clinic, appointment.service_ref, appointment.practitioner)
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


# ── Waitlist ──────────────────────────────────────────────────────────────────

class WaitlistView(APIView):
    def get(self, request):
        clinic = get_default_clinic(request.user)
        entries = WaitlistEntry.objects.select_related("client", "service", "practitioner").filter(clinic=clinic)
        return Response(WaitlistEntrySerializer(entries, many=True).data)

    def post(self, request):
        clinic = get_default_clinic(request.user)
        serializer = WaitlistEntrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(clinic=clinic)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class WaitlistEntryDetailView(APIView):
    def patch(self, request, entry_id):
        clinic = get_default_clinic(request.user)
        entry = get_object_or_404(WaitlistEntry, pk=entry_id, clinic=clinic)
        serializer = WaitlistEntrySerializer(entry, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, entry_id):
        clinic = get_default_clinic(request.user)
        entry = get_object_or_404(WaitlistEntry, pk=entry_id, clinic=clinic)
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── No-Show ───────────────────────────────────────────────────────────────────

class MarkNoShowView(APIView):
    def post(self, request, appointment_id):
        user = request.user
        clinic = get_default_clinic(user)
        appointment = get_object_or_404(Appointment, pk=appointment_id, clinic=clinic, owner=user)

        if appointment.status in (Appointment.Status.CANCELLED, Appointment.Status.NO_SHOW):
            return Response({"detail": "Appointment already resolved."}, status=status.HTTP_400_BAD_REQUEST)

        appointment.status = Appointment.Status.NO_SHOW
        appointment.save(update_fields=["status", "updated_at"])
        appointment.reminders.update(status="cancelled")

        # Charge no-show fee if protection is enabled and client has a card
        payment = None
        if clinic.noshow_protection_enabled and clinic.noshow_fee_cents > 0:
            payment = Payment.objects.create(
                owner=user,
                clinic=clinic,
                client=appointment.client,
                appointment=appointment,
                kind=Payment.Kind.INVOICE,
                provider=clinic.payment_provider,
                amount_cents=clinic.noshow_fee_cents,
                currency="CAD",
                status=Payment.Status.UNPAID,
            )
            # TODO: auto-charge saved card via Stripe when card-on-file is implemented

        return Response({
            "appointment": AppointmentSerializer(appointment, context={"request": request}).data,
            "no_show_fee_created": payment is not None,
            "fee_cents": clinic.noshow_fee_cents if payment else 0,
        })


# ── Send a reminder on demand ─────────────────────────────────────────────────

class SendAppointmentReminderView(APIView):
    def post(self, request, appointment_id):
        from django.core.mail import send_mail
        from .models import AppointmentReminder

        user = request.user
        clinic = get_default_clinic(user)
        appointment = get_object_or_404(Appointment, pk=appointment_id, clinic=clinic, owner=user)
        client = appointment.client

        if not client.email:
            return Response({"detail": "Client has no email on file."}, status=status.HTTP_400_BAD_REQUEST)

        practitioner = appointment.practitioner.name if appointment.practitioner else "your practitioner"
        subject = f"Appointment reminder – {clinic.name}"
        body = (
            f"Hi {client.first_name},\n\n"
            f"This is a reminder of your {appointment.service} appointment at {clinic.name}.\n\n"
            f"Date: {appointment.date} at {appointment.time.strftime('%H:%M')}\n"
            f"Practitioner: {practitioner}\n\n"
            f"To cancel or reschedule, visit your client portal.\n\n{clinic.name}"
        )
        from_email = clinic.reminder_email or "reminders@solormt.com"

        # Reuse the existing confirmation/email row if one was already queued
        # (unique on appointment+kind+channel), otherwise create it.
        reminder, _ = AppointmentReminder.objects.update_or_create(
            clinic=clinic,
            appointment=appointment,
            kind=AppointmentReminder.Kind.CONFIRMATION,
            channel=AppointmentReminder.Channel.EMAIL,
            defaults={
                "scheduled_for": timezone.now(),
                "message": "Manual reminder sent from dashboard.",
            },
        )
        sent = False
        try:
            send_mail(subject, body, from_email, [client.email], fail_silently=False)
            sent = True
            reminder.status = AppointmentReminder.Status.SENT
            reminder.save(update_fields=["status"])
        except Exception as exc:  # noqa: BLE001
            reminder.message = f"Send failed: {exc}"
            reminder.save(update_fields=["message"])

        return Response({"sent": sent, "channel": "email", "to": client.email})


# ── Packages / Memberships ────────────────────────────────────────────────────

class PackageListView(APIView):
    def get(self, request):
        clinic = get_default_clinic(request.user)
        packages = Package.objects.filter(clinic=clinic)
        return Response(PackageSerializer(packages, many=True).data)

    def post(self, request):
        clinic = get_default_clinic(request.user)
        serializer = PackageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service_id = request.data.get("service")
        service = None
        if service_id:
            service = get_object_or_404(Service, pk=service_id, clinic=clinic)
        serializer.save(clinic=clinic, service=service)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ClientPackageListView(APIView):
    def get(self, request):
        clinic = get_default_clinic(request.user)
        packages = ClientPackage.objects.select_related("client", "package").filter(clinic=clinic)
        return Response(ClientPackageSerializer(packages, many=True).data)

    def post(self, request):
        """Purchase a package for a client."""
        from datetime import timedelta
        clinic = get_default_clinic(request.user)
        package = get_object_or_404(Package, pk=request.data.get("package_id"), clinic=clinic, is_active=True)
        client = get_object_or_404(Client, pk=request.data.get("client_id"), clinic=clinic)

        expires_at = None
        if package.validity_days:
            expires_at = date_type.today() + timedelta(days=package.validity_days)

        payment = Payment.objects.create(
            owner=request.user,
            clinic=clinic,
            client=client,
            kind=Payment.Kind.FULL_PAYMENT,
            provider=clinic.payment_provider,
            amount_cents=package.price_cents,
            currency="CAD",
            status=Payment.Status.UNPAID,
        )

        client_package = ClientPackage.objects.create(
            clinic=clinic,
            client=client,
            package=package,
            package_name=package.name,
            sessions_total=package.sessions,
            price_cents=package.price_cents,
            expires_at=expires_at,
            payment=payment,
        )
        return Response(ClientPackageSerializer(client_package).data, status=status.HTTP_201_CREATED)


class RedeemPackageSessionView(APIView):
    def post(self, request, client_package_id):
        clinic = get_default_clinic(request.user)
        cp = get_object_or_404(ClientPackage, pk=client_package_id, clinic=clinic)

        if cp.status != ClientPackage.Status.ACTIVE:
            return Response({"detail": f"Package is {cp.status}."}, status=status.HTTP_400_BAD_REQUEST)
        if cp.sessions_remaining <= 0:
            return Response({"detail": "No sessions remaining."}, status=status.HTTP_400_BAD_REQUEST)
        if cp.expires_at and cp.expires_at < date_type.today():
            cp.status = ClientPackage.Status.EXPIRED
            cp.save(update_fields=["status"])
            return Response({"detail": "Package has expired."}, status=status.HTTP_400_BAD_REQUEST)

        cp.sessions_used += 1
        if cp.sessions_remaining == 0:
            cp.status = ClientPackage.Status.EXHAUSTED
        cp.save(update_fields=["sessions_used", "status"])
        return Response(ClientPackageSerializer(cp).data)


# ── Insurance / TELUS eClaims ─────────────────────────────────────────────────

class InsuranceClaimListView(APIView):
    def get(self, request):
        clinic = get_default_clinic(request.user)
        claims = InsuranceClaim.objects.select_related("client", "appointment").filter(clinic=clinic)
        return Response(InsuranceClaimSerializer(claims, many=True).data)

    def post(self, request):
        clinic = get_default_clinic(request.user)
        serializer = InsuranceClaimSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claim = serializer.save(owner=request.user, clinic=clinic)
        return Response(InsuranceClaimSerializer(claim).data, status=status.HTTP_201_CREATED)


class SubmitInsuranceClaimView(APIView):
    def post(self, request, claim_id):
        """
        Submit the claim to TELUS eClaims (or mark as submitted for manual/paper claims).

        Real TELUS eClaims integration requires a registered provider account and
        uses their REST API at https://telus.com/eclaims. Wire in your credentials
        via TELUS_ECLAIMS_CLIENT_ID / TELUS_ECLAIMS_CLIENT_SECRET in settings.

        This implementation sends a realistic mock response so the workflow is
        complete end-to-end. Replace _submit_to_telus() with the real call.
        """
        import uuid
        clinic = get_default_clinic(request.user)
        claim = get_object_or_404(InsuranceClaim, pk=claim_id, clinic=clinic, owner=request.user)

        if claim.status not in (InsuranceClaim.Status.DRAFT,):
            return Response({"detail": "Only draft claims can be submitted."}, status=status.HTTP_400_BAD_REQUEST)

        if claim.provider == InsuranceClaim.Provider.TELUS:
            response_data = _submit_to_telus(claim)
        else:
            # Manual / paper — mark submitted and await manual update
            response_data = {"claim_number": f"MANUAL-{claim.pk}", "status": "submitted", "message": "Manual claim marked as submitted."}

        claim.claim_number = response_data.get("claim_number", str(uuid.uuid4())[:8].upper())
        claim.status = InsuranceClaim.Status.SUBMITTED
        claim.response_message = response_data.get("message", "")
        claim.submitted_at = timezone.now()
        claim.save(update_fields=["claim_number", "status", "response_message", "submitted_at", "updated_at"])

        return Response(InsuranceClaimSerializer(claim).data)


def _submit_to_telus(claim: InsuranceClaim) -> dict:
    """
    Stub for the TELUS eClaims API submission.

    To implement for real:
    1. Register at https://provider.telus.com/eclaims
    2. Set TELUS_ECLAIMS_CLIENT_ID and TELUS_ECLAIMS_CLIENT_SECRET in your .env
    3. Replace the mock below with an actual OAuth2 + REST call

    The TELUS eClaims API accepts a JSON payload with:
      - providerNumber, serviceDate, diagnosisCode, serviceCode
      - patient: { firstName, lastName, memberID, planNumber, groupNumber }
      - services: [{ serviceCode, quantity, unitFee }]
    """
    import uuid
    # Mock response — replace with real TELUS API call
    return {
        "claim_number": f"TC-{uuid.uuid4().hex[:8].upper()}",
        "status": "submitted",
        "message": "Claim submitted to TELUS eClaims. Awaiting insurer response (typically 30–60 seconds for real-time adjudication).",
    }


# ── Public intake form completion (tokenized, no login) ───────────────────────

class PublicIntakeView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "intake"

    def get(self, request, token):
        intake = get_object_or_404(IntakeResponse.objects.select_related("clinic", "client", "appointment"), token=token)
        valid = intake.token_is_valid
        # Redact the stored health history once the link is no longer an editable
        # draft (completed or expired), so a leaked URL can't expose PHI.
        return Response({
            "clinic_name": intake.clinic.name,
            "client_first_name": intake.client.first_name,
            "status": intake.status,
            "completed": intake.status == IntakeResponse.Status.COMPLETED,
            "expired": bool(intake.token_expires_at and not valid and intake.status != IntakeResponse.Status.COMPLETED),
            "editable": valid,
            "health_history": intake.health_history if valid else "",
            "consent_accepted": intake.consent_accepted,
            "appointment_date": intake.appointment.date.isoformat() if intake.appointment else None,
            "appointment_time": intake.appointment.time.strftime("%H:%M") if intake.appointment else None,
        })

    def post(self, request, token):
        intake = get_object_or_404(IntakeResponse, token=token)
        if not intake.token_is_valid:
            # Already completed or expired — one-time use.
            return Response(
                {"detail": "This intake link has expired or was already completed. Contact the clinic for a new link."},
                status=status.HTTP_410_GONE,
            )
        health_history = str(request.data.get("health_history", "")).strip()
        consent = bool(request.data.get("consent_accepted"))
        if not consent:
            return Response({"detail": "Consent is required to complete the form."}, status=status.HTTP_400_BAD_REQUEST)
        intake.health_history = health_history
        intake.consent_accepted = consent
        intake.status = IntakeResponse.Status.COMPLETED
        intake.completed_at = timezone.now()
        intake.save(update_fields=["health_history", "consent_accepted", "status", "completed_at"])
        return Response({"status": "completed", "message": "Thank you — your intake form is complete."})


# ── Client profile (Jane-style communication log) ─────────────────────────────

class ClientProfileView(APIView):
    def get(self, request, client_id):
        from soap_notes.models import SoapNote
        from soap_notes.serializers import SoapNoteSerializer

        clinic = get_default_clinic(request.user)
        client = get_object_or_404(Client, pk=client_id, clinic=clinic, owner=request.user)

        appointments = Appointment.objects.filter(clinic=clinic, client=client).select_related("practitioner")
        reminders = (
            AppointmentReminder.objects.filter(clinic=clinic, appointment__client=client)
            .select_related("appointment")
            .order_by("-scheduled_for")
        )
        intakes = IntakeResponse.objects.filter(clinic=clinic, client=client).order_by("-created_at")
        payments = Payment.objects.filter(clinic=clinic, client=client)
        soap_notes = SoapNote.objects.filter(clinic=clinic, client=client) if hasattr(SoapNote, "clinic") else SoapNote.objects.filter(client=client)

        from clients.serializers import ClientSerializer
        return Response({
            "client": ClientSerializer(client).data,
            "appointments": AppointmentSerializer(appointments, many=True, context={"request": request}).data,
            "reminders": [
                {
                    "id": r.id,
                    "kind": r.kind,
                    "kind_label": r.get_kind_display(),
                    "channel": r.channel,
                    "status": r.status,
                    "scheduled_for": r.scheduled_for,
                    "appointment_date": r.appointment.date.isoformat() if r.appointment else None,
                }
                for r in reminders
            ],
            "intake_responses": IntakeResponseSerializer(intakes, many=True).data,
            "payments": PaymentSerializer(payments, many=True, context={"request": request}).data,
            "soap_notes": SoapNoteSerializer(soap_notes, many=True, context={"request": request}).data,
        })


# ── Twilio inbound SMS webhook (STOP / START handling) ────────────────────────

class SmsWebhookView(APIView):
    """
    Twilio posts inbound texts here. Handles the carrier-required opt-out
    keywords. Point your Twilio number's "A MESSAGE COMES IN" webhook at
    POST /api/sms/webhook/.

    The X-Twilio-Signature header is validated whenever TWILIO_AUTH_TOKEN is set,
    so only genuine Twilio requests can change a client's consent state.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    STOP_WORDS = {"STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"}
    START_WORDS = {"START", "YES", "UNSTOP"}

    def _signature_ok(self, request) -> bool:
        from django.conf import settings

        if not settings.TWILIO_AUTH_TOKEN:
            return True  # dev / not configured — nothing to validate against
        try:
            from twilio.request_validator import RequestValidator

            validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)
            signature = request.META.get("HTTP_X_TWILIO_SIGNATURE", "")
            url = request.build_absolute_uri()
            params = {k: request.data.get(k) for k in request.data}
            return validator.validate(url, params, signature)
        except Exception:  # noqa: BLE001
            return False

    def post(self, request):
        if not self._signature_ok(request):
            return Response({"detail": "Invalid signature."}, status=status.HTTP_403_FORBIDDEN)
        from_number = str(request.data.get("From", "")).strip()
        body = str(request.data.get("Body", "")).strip().upper()
        digits = "".join(ch for ch in from_number if ch.isdigit())[-10:]

        reply = ""
        if digits:
            matches = [c for c in Client.objects.exclude(phone="") if "".join(ch for ch in c.phone if ch.isdigit())[-10:] == digits]
            if body in self.STOP_WORDS:
                for c in matches:
                    c.sms_opt_in = False
                    c.sms_opt_out_at = timezone.now()
                    c.save(update_fields=["sms_opt_in", "sms_opt_out_at", "updated_at"])
                reply = "You have been unsubscribed and will no longer receive SMS reminders. Reply START to opt back in."
            elif body in self.START_WORDS:
                for c in matches:
                    c.sms_opt_in = True
                    c.sms_opt_out_at = None
                    c.save(update_fields=["sms_opt_in", "sms_opt_out_at", "updated_at"])
                reply = "You are re-subscribed to SMS reminders. Reply STOP to opt out."

        twiml = f"<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response>{f'<Message>{reply}</Message>' if reply else ''}</Response>"
        from django.http import HttpResponse
        return HttpResponse(twiml, content_type="text/xml")


class PasswordResetRequestView(APIView):
    """
    POST /api/auth/password-reset/
    Takes an email address and sends a reset link if the account exists.
    Always returns 200 to avoid leaking which emails are registered.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if user:
            # Invalidate any existing unused tokens for this user
            PasswordResetToken.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())
            token = PasswordResetToken.objects.create(user=user)
            send_password_reset_email(token)
        return Response({"detail": "If that email is registered, a reset link has been sent."})


class PasswordResetConfirmView(APIView):
    """
    POST /api/auth/password-reset/confirm/
    Takes { token, password } and sets the new password if the token is valid.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from django.core.exceptions import ValidationError
        from .security import validate_strong_password

        token_str = str(request.data.get("token", "")).strip()
        password = str(request.data.get("password", ""))

        try:
            # A malformed (non-UUID) token raises Django's ValidationError, not ValueError.
            reset_token = PasswordResetToken.objects.select_related("user").get(token=token_str)
        except (PasswordResetToken.DoesNotExist, ValueError, ValidationError):
            return Response({"detail": "Invalid or expired reset link."}, status=status.HTTP_400_BAD_REQUEST)

        if not reset_token.is_valid:
            return Response({"detail": "This reset link has expired or has already been used."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_strong_password(password)
        except ValidationError as exc:
            return Response({"detail": " ".join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        reset_token.user.set_password(password)
        reset_token.user.save()
        reset_token.used_at = timezone.now()
        reset_token.save(update_fields=["used_at"])

        return Response({"detail": "Password updated. You can now log in."})
