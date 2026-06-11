from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase

from core.models import AuditLog
from .base import ApiTestCase


class AuditTrailTests(ApiTestCase):
    def test_writes_and_phi_reads_are_logged(self):
        self.owner_client()
        AuditLog.objects.all().delete()  # ignore registration noise

        cid = self.client.post(
            "/api/clients/", {"first_name": "Aud", "last_name": "It", "email": "aud@test.com"}, format="json"
        ).data["id"]
        self.client.get(f"/api/clients/{cid}/profile/")

        actions = list(AuditLog.objects.values_list("action", "resource"))
        self.assertIn(("POST", "clients"), actions)         # the write
        self.assertIn(("GET", "clients"), actions)          # the PHI profile read
        # the trail records who, not what
        row = AuditLog.objects.filter(action="POST", resource="clients").first()
        self.assertTrue(row.actor_email)
        self.assertTrue(row.ip_address)

    def test_token_endpoint_not_logged(self):
        # auth-token plumbing carries no PHI and is intentionally skipped
        self.register(email="noaudit@test.com")
        self.client.post("/api/auth/token/", {"username": "noaudit@test.com", "password": "OwnerPass123"}, format="json")
        self.assertFalse(AuditLog.objects.filter(path__startswith="/api/auth/token").exists())


class ThrottleTests(APITestCase):
    """Runs against the REAL throttle settings (no NO_THROTTLE override)."""

    def setUp(self):
        cache.clear()

    def test_auth_endpoint_throttles_after_limit(self):
        # auth scope is 8/min; the 9th request from the same IP should be blocked
        codes = []
        for i in range(10):
            resp = self.client.post(
                "/api/auth/register/",
                {"email": f"u{i}@test.com", "password": "OwnerPass123", "first_name": "U", "last_name": "N", "clinic_name": f"C{i}"},
                format="json",
            )
            codes.append(resp.status_code)
        self.assertIn(429, codes, f"expected a 429 in {codes}")
