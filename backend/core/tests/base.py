"""Shared helpers for the API test suite."""
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

# Throttling is cache-backed and would make multi-request tests flaky, so we
# disable it for the functional suite. test_security.py re-enables it to assert
# the limits actually fire.
NO_THROTTLE = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_THROTTLE_CLASSES": (),
    "DEFAULT_THROTTLE_RATES": {
        "anon": None,
        "user": None,
        "auth": None,
        "public_booking": None,
        "intake": None,
    },
}

LOCMEM_EMAIL = "django.core.mail.backends.locmem.EmailBackend"


@override_settings(REST_FRAMEWORK=NO_THROTTLE)
class ApiTestCase(APITestCase):
    """Base class: clears the throttle cache and provides auth helpers."""

    def setUp(self):
        cache.clear()

    # ── auth helpers ──────────────────────────────────────────────────────────
    def register(self, email="owner@test.com", password="OwnerPass123", clinic_name="Test Clinic",
                 first_name="Olive", last_name="Owner"):
        resp = self.client.post(
            "/api/auth/register/",
            {
                "email": email,
                "password": password,
                "first_name": first_name,
                "last_name": last_name,
                "clinic_name": clinic_name,
            },
            format="json",
        )
        assert resp.status_code == 201, resp.content
        return resp.data["access"]

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def owner_client(self, **kwargs):
        """Register + authenticate an owner, returning (token, clinic_dict)."""
        token = self.register(**kwargs)
        self.auth(token)
        clinic = self.client.get("/api/clinic/").data
        return token, clinic

    def service_by_name(self, clinic, name):
        return next(s for s in clinic["services"] if s["name"] == name)

    def first_practitioner(self, clinic):
        return clinic["practitioners"][0]
