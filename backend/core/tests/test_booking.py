from datetime import date, timedelta

from core.models import AppointmentReminder
from .base import ApiTestCase


def next_weekday():
    d = date.today() + timedelta(days=2)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d.isoformat()


class PublicBookingTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        _, self.clinic = self.owner_client()
        self.slug = self.clinic["slug"]
        self.massage = self.service_by_name(self.clinic, "Massage Therapy")
        self.practitioner = self.first_practitioner(self.clinic)

    def test_public_clinic_and_availability(self):
        pub = self.client.get(f"/api/public/clinics/{self.slug}/")
        self.assertEqual(pub.status_code, 200)
        self.assertEqual(pub.data["name"], self.clinic["name"])

        avail = self.client.get(
            f"/api/public/clinics/{self.slug}/availability/?service_id={self.massage['id']}&practitioner_id={self.practitioner['id']}"
        )
        self.assertEqual(avail.status_code, 200)
        self.assertTrue(avail.data["available_slots"])
        # every slot carries a duration
        self.assertIn("duration_minutes", avail.data["available_slots"][0])

    def _book(self, **overrides):
        payload = {
            "auth_mode": "register",
            "service_id": self.massage["id"],
            "practitioner_id": self.practitioner["id"],
            "date": next_weekday(),
            "time": "10:00",
            "first_name": "Client",
            "last_name": "One",
            "email": "client1@test.com",
            "password": "ClientPass123",
            "phone": "416-555-0300",
            "health_history": "none",
            "consent_accepted": True,
            "pay_deposit": False,
            "save_card": False,
            "sms_opt_in": False,
        }
        payload.update(overrides)
        return self.client.post(f"/api/public/clinics/{self.slug}/book/", payload, format="json")

    def test_booking_creates_appointment_client_and_tokens(self):
        resp = self._book()
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertTrue(resp.data["appointment_id"])
        self.assertTrue(resp.data["client_id"])
        self.assertTrue(resp.data["client_access"])
        self.assertEqual(resp.data["status"], "pending")

    def test_double_booking_same_slot_conflicts(self):
        self.assertEqual(self._book().status_code, 201)
        second = self._book(email="client2@test.com", first_name="Two")
        self.assertEqual(second.status_code, 409)

    def test_consent_required(self):
        resp = self._book(consent_accepted=False)
        self.assertEqual(resp.status_code, 400)

    def test_sms_opt_in_queues_sms_channel(self):
        # clinic must have SMS enabled for the channel to be queued
        self.client.patch("/api/clinic/", {"sms_enabled": True}, format="json")
        resp = self._book(sms_opt_in=True)
        self.assertEqual(resp.status_code, 201)
        channels = set(
            AppointmentReminder.objects.filter(appointment_id=resp.data["appointment_id"]).values_list("channel", flat=True)
        )
        self.assertIn("sms", channels)
        self.assertIn("email", channels)

    def test_no_sms_opt_in_email_only(self):
        self.client.patch("/api/clinic/", {"sms_enabled": True}, format="json")
        resp = self._book(sms_opt_in=False, time="11:00")
        channels = set(
            AppointmentReminder.objects.filter(appointment_id=resp.data["appointment_id"]).values_list("channel", flat=True)
        )
        self.assertEqual(channels, {"email"})
