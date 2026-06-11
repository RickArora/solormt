from core.models import Clinic, Practitioner, Service
from .base import ApiTestCase


class RegistrationTests(ApiTestCase):
    def test_register_creates_clinic_and_defaults(self):
        token = self.register(clinic_name="Lakeside Massage")
        self.auth(token)
        clinic = self.client.get("/api/clinic/").data

        self.assertEqual(clinic["name"], "Lakeside Massage")
        self.assertEqual(clinic["slug"], "lakeside-massage")
        # Default services, an intake template, and a primary practitioner are seeded.
        names = {s["name"] for s in clinic["services"]}
        self.assertEqual(names, {"Massage Therapy", "Initial Assessment", "Follow-up Treatment"})
        self.assertTrue(clinic["practitioners"])
        self.assertTrue(clinic["intake_templates"])

    def test_initial_assessment_requires_intake_by_default(self):
        _, clinic = self.owner_client()
        initial = self.service_by_name(clinic, "Initial Assessment")
        self.assertTrue(initial["requires_intake"])
        self.assertFalse(self.service_by_name(clinic, "Massage Therapy")["requires_intake"])

    def test_duplicate_email_rejected(self):
        self.register(email="dupe@test.com")
        resp = self.client.post(
            "/api/auth/register/",
            {"email": "dupe@test.com", "password": "OwnerPass123", "first_name": "A", "last_name": "B", "clinic_name": "X"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_short_password_rejected(self):
        resp = self.client.post(
            "/api/auth/register/",
            {"email": "shorty@test.com", "password": "Ab1!", "first_name": "A", "last_name": "B", "clinic_name": "X"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_eight_char_password_accepted(self):
        resp = self.client.post(
            "/api/auth/register/",
            {"email": "eight@test.com", "password": "Kx9mLp2q", "first_name": "A", "last_name": "B", "clinic_name": "Eight"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)


class LoginTests(ApiTestCase):
    def test_login_returns_tokens(self):
        self.register(email="login@test.com", password="OwnerPass123")
        resp = self.client.post("/api/auth/token/", {"username": "login@test.com", "password": "OwnerPass123"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

    def test_wrong_password_rejected(self):
        self.register(email="login2@test.com", password="OwnerPass123")
        resp = self.client.post("/api/auth/token/", {"username": "login2@test.com", "password": "nope"}, format="json")
        self.assertEqual(resp.status_code, 401)

    def test_protected_endpoint_requires_auth(self):
        resp = self.client.get("/api/clients/")
        self.assertEqual(resp.status_code, 401)
