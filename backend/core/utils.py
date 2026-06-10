from datetime import datetime, time, timedelta

from django.utils import timezone

from django.conf import settings
from django.core.mail import send_mail

from .models import AppointmentReminder, Clinic, ClinicMembership, IntakeTemplate, Practitioner, PractitionerAvailability, Service, WaitlistEntry


def send_intake_request(intake, is_reminder: bool = False) -> bool:
    """
    Email a client a tokenized link to complete their intake/consent form.
    Returns True if the email was accepted by the backend.
    """
    client = intake.client
    clinic = intake.clinic
    if not client.email:
        return False

    link = f"{settings.FRONTEND_BASE_URL}/intake/{intake.token}"
    from_email = clinic.reminder_email or settings.DEFAULT_FROM_EMAIL
    if is_reminder:
        subject = f"Reminder: please complete your intake form – {clinic.name}"
        opener = "This is a friendly reminder to complete your health history and consent form before your appointment."
    else:
        subject = f"Complete your intake form – {clinic.name}"
        opener = "Thanks for booking. Please complete your health history and consent form before your visit."

    body = (
        f"Hi {client.first_name},\n\n"
        f"{opener}\n\n"
        f"Complete it here: {link}\n\n"
        f"It only takes a couple of minutes and can be done on any device.\n\n"
        f"{clinic.name}"
    )
    try:
        send_mail(subject, body, from_email, [client.email], fail_silently=False)
        return True
    except Exception:  # noqa: BLE001
        return False


def get_default_clinic(user):
    membership = ClinicMembership.objects.select_related("clinic").filter(user=user).first()
    if membership:
        return membership.clinic

    profile = getattr(user, "profile", None)
    name = getattr(profile, "clinic_name", "") or f"{user.first_name or user.username} Clinic"
    clinic = Clinic.objects.create(owner=user, name=name)
    ClinicMembership.objects.create(user=user, clinic=clinic, role=ClinicMembership.Role.OWNER)
    ensure_clinic_defaults(clinic)
    return clinic


def ensure_clinic_defaults(clinic):
    if not clinic.services.exists():
        Service.objects.bulk_create(
            [
                Service(clinic=clinic, name="Massage Therapy", duration_minutes=60, price_cents=12000),
                Service(clinic=clinic, name="Initial Assessment", duration_minutes=75, price_cents=15000, requires_intake=True),
                Service(clinic=clinic, name="Follow-up Treatment", duration_minutes=45, price_cents=9500),
            ]
        )
    if not clinic.intake_templates.exists():
        IntakeTemplate.objects.create(
            clinic=clinic,
            name="New Client Intake + Consent",
            description="Health history, treatment consent, and clinic policy acknowledgement.",
        )
    if not clinic.practitioners.exists():
        practitioner = Practitioner.objects.create(
            clinic=clinic,
            first_name="Primary",
            last_name="Practitioner",
            display_name="Primary Practitioner",
            email=clinic.public_email,
            slot_duration_minutes=60,
            buffer_minutes=0,
            slot_duration_options=[30, 60, 90],
        )
        practitioner.services.set(clinic.services.all())
        PractitionerAvailability.objects.bulk_create(
            [
                PractitionerAvailability(practitioner=practitioner, weekday=weekday, start_time=time(9, 0), end_time=time(17, 0))
                for weekday in range(5)
            ]
        )


def queue_appointment_reminders(appointment):
    clinic = appointment.clinic
    if not clinic or not clinic.reminders_enabled:
        return

    appointment_start = timezone.make_aware(datetime.combine(appointment.date, appointment.time))
    reminders = [
        (AppointmentReminder.Kind.CONFIRMATION, timezone.now()),
        (AppointmentReminder.Kind.FORTY_EIGHT_HOUR, appointment_start - timedelta(hours=48)),
        (AppointmentReminder.Kind.SAME_DAY, appointment_start.replace(hour=8, minute=0, second=0, microsecond=0)),
    ]
    # Email always; SMS only when the clinic enables it AND the client opted in.
    channels = [AppointmentReminder.Channel.EMAIL]
    if clinic.sms_enabled and getattr(appointment.client, "sms_opt_in", False) and getattr(appointment.client, "phone", ""):
        channels.append(AppointmentReminder.Channel.SMS)
    for kind, scheduled_for in reminders:
        for channel in channels:
            AppointmentReminder.objects.get_or_create(
                clinic=clinic,
                appointment=appointment,
                kind=kind,
                channel=channel,
                defaults={
                    "scheduled_for": max(scheduled_for, timezone.now()),
                    "message": "Appointment reminder queued. SMS/email content must avoid health details.",
                },
            )


def notify_waitlist(clinic: Clinic, service, practitioner=None) -> int:
    """
    When a slot opens (appointment cancelled), notify waiting clients for the
    matching service (+optional practitioner). Returns the number notified.
    """
    qs = WaitlistEntry.objects.filter(
        clinic=clinic,
        service=service,
        status=WaitlistEntry.Status.WAITING,
    )
    if practitioner:
        qs = qs.filter(practitioner=practitioner) | WaitlistEntry.objects.filter(
            clinic=clinic, service=service, practitioner__isnull=True, status=WaitlistEntry.Status.WAITING
        )

    notified = 0
    from_email = clinic.reminder_email or "reminders@solormt.com"
    for entry in qs.select_related("client")[:10]:
        client = entry.client
        if client.email:
            try:
                send_mail(
                    subject=f"A spot opened up at {clinic.name}",
                    message=(
                        f"Hi {client.first_name},\n\n"
                        f"Good news — an opening just became available for {service.name} at {clinic.name}.\n\n"
                        f"Book now: {clinic.booking_url if hasattr(clinic, 'booking_url') else '/book/' + clinic.slug}\n\n"
                        f"{clinic.name}"
                    ),
                    from_email=from_email,
                    recipient_list=[client.email],
                    fail_silently=True,
                )
            except Exception:
                pass
        entry.status = WaitlistEntry.Status.NOTIFIED
        entry.notified_at = timezone.now()
        entry.save(update_fields=["status", "notified_at"])
        notified += 1

    return notified
