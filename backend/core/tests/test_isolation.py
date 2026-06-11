"""Cross-tenant isolation: clinic B must never see or touch clinic A's data."""
from datetime import date, timedelta

from .base import ApiTestCase


def future():
    return (date.today() + timedelta(days=3)).isoformat()


class TenantIsolationTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        # Clinic A with one of everything
        self.token_a = self.register(email="a@test.com", clinic_name="Clinic A")
        self.auth(self.token_a)
        self.client_a = self.client.post(
            "/api/clients/", {"first_name": "Alice", "last_name": "A", "email": "alice@test.com"}, format="json"
        ).data
        self.appt_a = self.client.post(
            "/api/appointments/",
            {"client": self.client_a["id"], "service": "Massage Therapy", "date": future(), "time": "10:00",
             "duration_minutes": 60, "status": "confirmed", "notes": ""},
            format="json",
        ).data
        clinic_a = self.client.get("/api/clinic/").data
        self.practitioner_a = clinic_a["practitioners"][0]
        self.waitlist_a = self.client.post(
            "/api/waitlist/", {"client": self.client_a["id"], "service": clinic_a["services"][0]["id"]}, format="json"
        ).data
        self.package_a = self.client.post(
            "/api/packages/", {"name": "A-Pack", "sessions": 5, "validity_days": 90, "price_cents": 50000, "is_active": True},
            format="json",
        ).data
        self.claim_a = self.client.post(
            "/api/insurance-claims/",
            {"client": self.client_a["id"], "provider": "telus", "service_date": date.today().isoformat(),
             "amount_submitted_cents": 12000},
            format="json",
        ).data

        # Clinic B, authenticated for all tests
        self.token_b = self.register(email="b@test.com", clinic_name="Clinic B")
        self.auth(self.token_b)

    def test_clients_not_visible_across_clinics(self):
        listed = self.client.get("/api/clients/").data
        self.assertEqual(listed, [])
        profile = self.client.get(f"/api/clients/{self.client_a['id']}/profile/")
        self.assertEqual(profile.status_code, 404)

    def test_appointments_not_visible_or_editable(self):
        self.assertEqual(self.client.get("/api/appointments/").data, [])
        patched = self.client.patch(f"/api/appointments/{self.appt_a['id']}/", {"status": "cancelled"}, format="json")
        self.assertEqual(patched.status_code, 404)
        noshow = self.client.post(f"/api/appointments/{self.appt_a['id']}/no-show/", {}, format="json")
        self.assertEqual(noshow.status_code, 404)
        reminder = self.client.post(f"/api/appointments/{self.appt_a['id']}/send-reminder/", {}, format="json")
        self.assertEqual(reminder.status_code, 404)

    def test_practitioner_not_editable(self):
        patched = self.client.patch(
            f"/api/practitioners/{self.practitioner_a['id']}/", {"slot_duration_minutes": 15}, format="json"
        )
        self.assertEqual(patched.status_code, 404)

    def test_waitlist_package_claim_isolated(self):
        self.assertEqual(self.client.get("/api/waitlist/").data, [])
        self.assertEqual(self.client.delete(f"/api/waitlist/{self.waitlist_a['id']}/").status_code, 404)
        self.assertEqual(self.client.get("/api/packages/").data, [])
        purchase = self.client.post(
            "/api/client-packages/", {"package_id": self.package_a["id"], "client_id": self.client_a["id"]}, format="json"
        )
        self.assertEqual(purchase.status_code, 404)
        self.assertEqual(self.client.get("/api/insurance-claims/").data, [])
        submit = self.client.post(f"/api/insurance-claims/{self.claim_a['id']}/submit/", {}, format="json")
        self.assertEqual(submit.status_code, 404)

    def test_cannot_book_appointment_for_other_clinics_client(self):
        resp = self.client.post(
            "/api/appointments/",
            {"client": self.client_a["id"], "service": "Massage Therapy", "date": future(), "time": "11:00",
             "duration_minutes": 60, "status": "confirmed", "notes": ""},
            format="json",
        )
        self.assertIn(resp.status_code, (400, 404))

    def test_cannot_record_payment_for_other_clinics_client(self):
        resp = self.client.post(
            "/api/payments/",
            {"client": self.client_a["id"], "amount_cents": 9999, "currency": "CAD", "status": "paid"},
            format="json",
        )
        self.assertIn(resp.status_code, (400, 404))

    def test_metrics_are_scoped(self):
        metrics = self.client.get("/api/dashboard/metrics/").data
        self.assertEqual(metrics["total_clients"], 0)
        self.assertEqual(metrics["upcoming_appointments"], 0)
