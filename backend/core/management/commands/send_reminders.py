"""
Management command: send_reminders

Processes queued AppointmentReminder records that are due and sends
email (and optionally SMS) notifications.

Run on a cron or via a task runner:
    python manage.py send_reminders

Email is sent through Django's email backend (configure EMAIL_* settings).
SMS is a stub — wire up Twilio or a similar provider by filling in send_sms().
"""
from datetime import timedelta

from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import AppointmentReminder


class Command(BaseCommand):
    help = "Send queued appointment reminders (email + SMS stubs)"

    def handle(self, *args, **options):
        now = timezone.now()
        due = AppointmentReminder.objects.select_related(
            "appointment__client", "appointment__clinic", "clinic"
        ).filter(status=AppointmentReminder.Status.QUEUED, scheduled_for__lte=now)

        sent = 0
        failed = 0

        for reminder in due:
            appointment = reminder.appointment
            client = appointment.client
            clinic = reminder.clinic

            if reminder.channel == AppointmentReminder.Channel.EMAIL:
                success = self._send_email(reminder, appointment, client, clinic)
            else:
                success = self._send_sms(reminder, appointment, client, clinic)

            if success:
                reminder.status = AppointmentReminder.Status.SENT
                reminder.save(update_fields=["status"])
                sent += 1
            else:
                failed += 1

        intake_chased = self._chase_incomplete_intakes(now)

        self.stdout.write(
            self.style.SUCCESS(
                f"Reminders processed: {sent} sent, {failed} failed. Intake forms chased: {intake_chased}."
            )
        )

    def _chase_incomplete_intakes(self, now) -> int:
        """
        Send a one-time '24h before, form still incomplete' reminder for intake
        forms tied to an upcoming appointment. Deduped via reminder_sent_at.
        """
        from datetime import datetime, timedelta

        from core.models import IntakeResponse
        from core.utils import send_intake_request

        window_end = now + timedelta(hours=24)
        candidates = (
            IntakeResponse.objects.select_related("client", "clinic", "appointment")
            .filter(status=IntakeResponse.Status.SENT, reminder_sent_at__isnull=True, appointment__isnull=False)
        )
        chased = 0
        for intake in candidates:
            appt = intake.appointment
            try:
                start = timezone.make_aware(datetime.combine(appt.date, appt.time))
            except Exception:  # noqa: BLE001
                continue
            # Only chase if the appointment is within the next 24h and still in the future.
            if now < start <= window_end:
                if send_intake_request(intake, is_reminder=True):
                    intake.reminder_sent_at = now
                    intake.save(update_fields=["reminder_sent_at"])
                    chased += 1
        return chased

    def _send_email(self, reminder, appointment, client, clinic) -> bool:
        if not client.email:
            return False

        from_email = clinic.reminder_email or "reminders@solormt.com"
        subject, body = self._compose(reminder, appointment, client, clinic)

        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=[client.email],
                fail_silently=False,
            )
            return True
        except Exception as exc:
            self.stderr.write(f"Email failed for reminder {reminder.pk}: {exc}")
            return False

    def _send_sms(self, reminder, appointment, client, clinic) -> bool:
        """
        Send an SMS reminder via Twilio.

        Guardrails (compliance + safety):
        - Clinic must have SMS enabled and the client must have opted in.
        - We never put health details in the body (see _compose / _sms_body).
        - Texts only deliver after carrier registration (US A2P 10DLC /
          Canada verified number) — see docs/SMS_SETUP.md.

        Falls back to a console print when Twilio isn't configured, so dev
        and tests don't silently fail.
        """
        from django.conf import settings

        if not client.phone or not clinic.sms_enabled or not getattr(client, "sms_opt_in", False):
            return False

        body = self._sms_body(reminder, appointment, client, clinic)

        # No Twilio creds → dev/console fallback.
        if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER):
            self.stdout.write(f"[SMS console] To {client.phone}: {body}")
            return True

        try:
            from twilio.rest import Client as TwilioClient

            twilio = TwilioClient(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            twilio.messages.create(body=body, from_=settings.TWILIO_FROM_NUMBER, to=client.phone)
            return True
        except Exception as exc:  # noqa: BLE001
            self.stderr.write(f"SMS failed for reminder {reminder.pk}: {exc}")
            return False

    def _sms_body(self, reminder, appointment, client, clinic) -> str:
        """Short, health-detail-free SMS copy with required opt-out language."""
        from core.models import AppointmentReminder

        time_str = appointment.time.strftime("%-I:%M %p")
        if reminder.kind == AppointmentReminder.Kind.SAME_DAY:
            when = f"today at {time_str}"
        elif reminder.kind == AppointmentReminder.Kind.FORTY_EIGHT_HOUR:
            when = f"{appointment.date.strftime('%a %b %-d')} at {time_str}"
        else:
            when = f"{appointment.date.strftime('%a %b %-d')} at {time_str}"
        return (
            f"{clinic.name}: reminder of your appointment {when}. "
            f"Reply STOP to opt out."
        )

    def _compose(self, reminder, appointment, client, clinic):
        practitioner = appointment.practitioner_name if hasattr(appointment, "practitioner_name") else str(appointment.practitioner or "your practitioner")
        date_str = appointment.date.strftime("%A, %B %-d")
        time_str = appointment.time.strftime("%-I:%M %p")

        if reminder.kind == AppointmentReminder.Kind.CONFIRMATION:
            subject = f"Appointment confirmed – {clinic.name}"
            body = (
                f"Hi {client.first_name},\n\n"
                f"Your {appointment.service} appointment at {clinic.name} is confirmed.\n\n"
                f"Date: {date_str} at {time_str}\n"
                f"Practitioner: {practitioner}\n\n"
                f"To cancel or reschedule, visit your client portal or contact us at least "
                f"{clinic.cancellation_window_hours} hours before your appointment.\n\n"
                f"See you soon,\n{clinic.name}"
            )
        elif reminder.kind == AppointmentReminder.Kind.FORTY_EIGHT_HOUR:
            subject = f"Reminder: appointment in 2 days – {clinic.name}"
            body = (
                f"Hi {client.first_name},\n\n"
                f"Just a reminder that your {appointment.service} appointment is coming up.\n\n"
                f"Date: {date_str} at {time_str}\n"
                f"Practitioner: {practitioner}\n\n"
                f"Need to cancel? You have until {(appointment.date).__str__()} to do so without a fee.\n\n"
                f"{clinic.name}"
            )
        else:
            subject = f"Today's appointment – {clinic.name}"
            body = (
                f"Hi {client.first_name},\n\n"
                f"Your {appointment.service} appointment is today at {time_str} with {practitioner}.\n\n"
                f"See you soon,\n{clinic.name}"
            )

        return subject, body
