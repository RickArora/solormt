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

        self.stdout.write(
            self.style.SUCCESS(f"Reminders processed: {sent} sent, {failed} failed.")
        )

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
        Stub: wire up Twilio or a similar provider here.
        Example with Twilio:
            from twilio.rest import Client as TwilioClient
            twilio = TwilioClient(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            twilio.messages.create(
                body=body,
                from_=settings.TWILIO_FROM_NUMBER,
                to=client.phone,
            )
        """
        if not client.phone or not clinic.sms_enabled:
            return False
        _, body = self._compose(reminder, appointment, client, clinic)
        self.stdout.write(f"[SMS stub] To {client.phone}: {body[:80]}")
        return True

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
