from datetime import datetime, time, timedelta

from django.utils import timezone

from .models import AppointmentReminder, Clinic, ClinicMembership, IntakeTemplate, Practitioner, PractitionerAvailability, Service


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
                Service(clinic=clinic, name="Initial Assessment", duration_minutes=75, price_cents=15000),
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
    for kind, scheduled_for in reminders:
        for channel in (AppointmentReminder.Channel.EMAIL, AppointmentReminder.Channel.SMS):
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
