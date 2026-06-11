"""Client-facing portal: auth, viewing own records, cancel/reschedule rules."""
from datetime import date, datetime, timedelta

from django.utils import timezone

from appointments.models import Appointment
from .base import ApiTestCase


def next_weekday(days_ahead=3):
    d = date.today() + timedelta(days=days_ahead)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d.isoformat()


class PortalAuthTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        _, clinic = self.owner_client()
        self.slug = clinic["slug"]
        self.client.credentials()  # portal calls are unauthenticated until login

    def test_register_then_login(self):
        reg = self.client.post(
            f"/api/public/clinics/{self.slug}/portal/auth/",
            {"mode": "register", "email": "portal@test.com", "password": "PortalPass123",
             "first_name": "Pat", "last_name": "Portal", "phone": ""},
            format="json",
        )
        self.assertEqual(reg.status_code, 200, reg.content)
        self.assertTrue(reg.data["access"])
        self.assertTrue(reg.data["client_id"])

        login = self.client.post(
            f"/api/public/clinics/{self.slug}/portal/auth/",
            {"mode": "login", "email": "portal@test.com", "password": "PortalPass123"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)

    def test_wrong_password_rejected(self):
        self.client.post(
            f"/api/public/clinics/{self.slug}/portal/auth/",
            {"mode": "register", "email": "p2@test.com", "password": "PortalPass123", "first_name": "P", "last_name": "Two"},
            format="json",
        )
        bad = self.client.post(
            f"/api/public/clinics/{self.slug}/portal/auth/",
            {"mode": "login", "email": "p2@test.com", "password": "WrongPass123"},
            format="json",
        )
        self.assertEqual(bad.status_code, 400)


class PortalRecordsTests(ApiTestCase):
    """Book via the public flow, then exercise the portal with the client JWT."""

    def setUp(self):
        super().setUp()
        _, clinic = self.owner_client()
        self.slug = clinic["slug"]
        massage = self.service_by_name(clinic, "Massage Therapy")
        practitioner = self.first_practitioner(clinic)
        book = self.client.post(
            f"/api/public/clinics/{self.slug}/book/",
            {"auth_mode": "register", "service_id": massage["id"], "practitioner_id": practitioner["id"],
             "date": next_weekday(), "time": "10:00", "first_name": "Cli", "last_name": "Ent",
             "email": "cli@test.com", "password": "ClientPass123", "phone": "", "health_history": "x",
             "consent_accepted": True, "pay_deposit": False, "save_card": False, "sms_opt_in": False},
            format="json",
        )
        assert book.status_code == 201, book.content
        self.appt_id = book.data["appointment_id"]
        self.auth(book.data["client_access"])

    def test_portal_shows_own_records(self):
        portal = self.client.get(f"/api/client/clinics/{self.slug}/portal/")
        self.assertEqual(portal.status_code, 200)
        self.assertEqual(portal.data["client"]["email"], "cli@test.com")
        self.assertEqual(len(portal.data["appointments"]), 1)
        self.assertEqual(len(portal.data["intake_responses"]), 1)

    def test_reschedule_outside_window(self):
        new_date = next_weekday(days_ahead=10)
        resp = self.client.post(
            f"/api/client/clinics/{self.slug}/appointments/{self.appt_id}/reschedule/",
            {"date": new_date, "time": "11:00"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data["date"], new_date)
        self.assertEqual(resp.data["status"], "pending")

    def test_cancel_inside_window_blocked(self):
        # move the appointment to a few hours from now — inside the 24h window
        soon = timezone.localtime() + timedelta(hours=3)
        Appointment.objects.filter(id=self.appt_id).update(date=soon.date(), time=soon.time())
        resp = self.client.post(
            f"/api/client/clinics/{self.slug}/appointments/{self.appt_id}/cancel/", {}, format="json"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("hours notice", str(resp.data.get("detail", "")))

    def test_cancel_outside_window_succeeds(self):
        resp = self.client.post(
            f"/api/client/clinics/{self.slug}/appointments/{self.appt_id}/cancel/", {}, format="json"
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data["status"], "cancelled")

    def test_other_clients_appointment_not_reachable(self):
        # a second portal client must not act on the first client's appointment
        self.client.credentials()
        other = self.client.post(
            f"/api/public/clinics/{self.slug}/portal/auth/",
            {"mode": "register", "email": "other@test.com", "password": "OtherPass123", "first_name": "O", "last_name": "T"},
            format="json",
        )
        self.auth(other.data["access"])
        resp = self.client.post(
            f"/api/client/clinics/{self.slug}/appointments/{self.appt_id}/cancel/", {}, format="json"
        )
        self.assertEqual(resp.status_code, 404)
