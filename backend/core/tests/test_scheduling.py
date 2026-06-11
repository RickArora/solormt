"""Slot generation specifics + on-demand reminders + the intake chase."""
from datetime import date, timedelta

from django.core import mail
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone

from core.models import IntakeResponse
from .base import ApiTestCase, LOCMEM_EMAIL


def next_weekday(days_ahead=3):
    d = date.today() + timedelta(days=days_ahead)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d.isoformat()


class SlotGenerationTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        _, self.clinic = self.owner_client()
        self.slug = self.clinic["slug"]
        self.massage = self.service_by_name(self.clinic, "Massage Therapy")
        self.practitioner = self.first_practitioner(self.clinic)

    def _slots(self, extra=""):
        resp = self.client.get(
            f"/api/public/clinics/{self.slug}/availability/?service_id={self.massage['id']}"
            f"&practitioner_id={self.practitioner['id']}{extra}"
        )
        return resp.data["available_slots"]

    def test_slots_honor_duration_and_buffer(self):
        # 45-minute slots with a 15-minute buffer -> starts every 60 min (09:00, 10:00, ...)
        self.client.patch(
            f"/api/practitioners/{self.practitioner['id']}/",
            {"slot_duration_minutes": 45, "buffer_minutes": 15},
            format="json",
        )
        times = sorted({s["time"] for s in self._slots()})
        self.assertTrue(times)
        self.assertTrue(all(t.endswith(":00") for t in times), times)
        self.assertTrue(all(s["duration_minutes"] == 45 for s in self._slots()))

    def test_horizon_parameter_extends_lookahead(self):
        short = {s["date"] for s in self._slots("&days=7")}
        long = {s["date"] for s in self._slots("&days=120")}
        self.assertGreater(max(long), max(short))

    def test_booked_slot_disappears(self):
        slot = self._slots()[0]
        book = self.client.post(
            f"/api/public/clinics/{self.slug}/book/",
            {"auth_mode": "register", "service_id": self.massage["id"], "practitioner_id": self.practitioner["id"],
             "date": slot["date"], "time": slot["time"], "first_name": "S", "last_name": "Lot",
             "email": "slot@test.com", "password": "SlotPass1234", "phone": "", "health_history": "x",
             "consent_accepted": True, "pay_deposit": False, "save_card": False, "sms_opt_in": False},
            format="json",
        )
        self.assertEqual(book.status_code, 201, book.content)
        remaining = {(s["date"], s["time"]) for s in self._slots()}
        self.assertNotIn((slot["date"], slot["time"]), remaining)


@override_settings(EMAIL_BACKEND=LOCMEM_EMAIL)
class SendReminderEndpointTests(ApiTestCase):
    def test_manual_reminder_emails_client(self):
        self.owner_client()
        cid = self.client.post(
            "/api/clients/", {"first_name": "Rem", "last_name": "Ind", "email": "remind@test.com"}, format="json"
        ).data["id"]
        aid = self.client.post(
            "/api/appointments/",
            {"client": cid, "service": "Massage Therapy", "date": next_weekday(), "time": "10:00",
             "duration_minutes": 60, "status": "confirmed", "notes": ""},
            format="json",
        ).data["id"]
        resp = self.client.post(f"/api/appointments/{aid}/send-reminder/", {}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertTrue(resp.data["sent"])
        self.assertEqual(resp.data["to"], "remind@test.com")
        self.assertEqual(len(mail.outbox), 1)
        # reminders must not contain health details
        self.assertNotIn("health", mail.outbox[0].body.lower())

    def test_client_without_email_rejected(self):
        self.owner_client()
        cid = self.client.post(
            "/api/clients/", {"first_name": "No", "last_name": "Mail", "email": ""}, format="json"
        ).data["id"]
        aid = self.client.post(
            "/api/appointments/",
            {"client": cid, "service": "Massage Therapy", "date": next_weekday(), "time": "11:00",
             "duration_minutes": 60, "status": "confirmed", "notes": ""},
            format="json",
        ).data["id"]
        resp = self.client.post(f"/api/appointments/{aid}/send-reminder/", {}, format="json")
        self.assertEqual(resp.status_code, 400)


@override_settings(EMAIL_BACKEND=LOCMEM_EMAIL)
class IntakeChaseTests(ApiTestCase):
    def test_incomplete_intake_with_imminent_appointment_is_chased_once(self):
        _, clinic = self.owner_client()
        from core.models import Clinic
        from clients.models import Client as ClientModel
        from appointments.models import Appointment

        clinic_obj = Clinic.objects.get(slug=clinic["slug"])
        client_obj = ClientModel.objects.create(
            clinic=clinic_obj, owner=clinic_obj.owner, first_name="Chase", last_name="Me", email="chase@test.com"
        )
        soon = timezone.localtime() + timedelta(hours=12)
        appt = Appointment.objects.create(
            owner=clinic_obj.owner, clinic=clinic_obj, client=client_obj, service="Massage Therapy",
            date=soon.date(), time=soon.time(), duration_minutes=60, status="confirmed",
        )
        intake = IntakeResponse.objects.create(
            clinic=clinic_obj, client=client_obj, appointment=appt, status="sent",
            token_expires_at=timezone.now() + timedelta(days=14),
        )

        call_command("send_reminders")
        intake.refresh_from_db()
        self.assertIsNotNone(intake.reminder_sent_at)
        chase_emails = [m for m in mail.outbox if "intake" in m.subject.lower()]
        self.assertEqual(len(chase_emails), 1)

        # running again must not double-chase
        mail.outbox.clear()
        call_command("send_reminders")
        self.assertEqual(len([m for m in mail.outbox if "intake" in m.subject.lower()]), 0)
