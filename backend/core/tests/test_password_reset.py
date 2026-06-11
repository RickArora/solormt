from datetime import timedelta

from django.core import mail
from django.test import override_settings
from django.utils import timezone

from core.models import PasswordResetToken
from .base import ApiTestCase, LOCMEM_EMAIL


@override_settings(EMAIL_BACKEND=LOCMEM_EMAIL)
class PasswordResetRequestTests(ApiTestCase):
    def test_known_email_sends_link_and_returns_200(self):
        self.register(email="reset@test.com")
        self.client.credentials()
        resp = self.client.post("/api/auth/password-reset/", {"email": "reset@test.com"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        token = PasswordResetToken.objects.get(user__email="reset@test.com")
        self.assertIn(str(token.token), mail.outbox[0].body)

    def test_unknown_email_returns_200_without_email(self):
        # same response either way, so the endpoint can't be used to enumerate accounts
        resp = self.client.post("/api/auth/password-reset/", {"email": "ghost@test.com"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_new_request_invalidates_previous_token(self):
        self.register(email="multi@test.com")
        self.client.credentials()
        self.client.post("/api/auth/password-reset/", {"email": "multi@test.com"}, format="json")
        first = PasswordResetToken.objects.get(user__email="multi@test.com", used_at__isnull=True)
        self.client.post("/api/auth/password-reset/", {"email": "multi@test.com"}, format="json")
        first.refresh_from_db()
        self.assertIsNotNone(first.used_at)  # superseded


@override_settings(EMAIL_BACKEND=LOCMEM_EMAIL)
class PasswordResetConfirmTests(ApiTestCase):
    def _token_for(self, email="confirm@test.com"):
        self.register(email=email)
        self.client.credentials()
        self.client.post("/api/auth/password-reset/", {"email": email}, format="json")
        return PasswordResetToken.objects.get(user__email=email, used_at__isnull=True)

    def test_valid_token_sets_new_password(self):
        token = self._token_for()
        resp = self.client.post(
            "/api/auth/password-reset/confirm/",
            {"token": str(token.token), "password": "BrandNewPass99"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        login = self.client.post(
            "/api/auth/token/", {"username": "confirm@test.com", "password": "BrandNewPass99"}, format="json"
        )
        self.assertEqual(login.status_code, 200)

    def test_token_is_single_use(self):
        token = self._token_for(email="single@test.com")
        self.client.post("/api/auth/password-reset/confirm/", {"token": str(token.token), "password": "BrandNewPass99"}, format="json")
        again = self.client.post("/api/auth/password-reset/confirm/", {"token": str(token.token), "password": "AnotherPass99"}, format="json")
        self.assertEqual(again.status_code, 400)

    def test_expired_token_rejected(self):
        token = self._token_for(email="expired@test.com")
        PasswordResetToken.objects.filter(pk=token.pk).update(created_at=timezone.now() - timedelta(hours=2))
        resp = self.client.post("/api/auth/password-reset/confirm/", {"token": str(token.token), "password": "BrandNewPass99"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_weak_password_rejected_token_stays_valid(self):
        token = self._token_for(email="weak@test.com")
        resp = self.client.post("/api/auth/password-reset/confirm/", {"token": str(token.token), "password": "password"}, format="json")
        self.assertEqual(resp.status_code, 400)
        token.refresh_from_db()
        self.assertIsNone(token.used_at)  # still usable with a proper password

    def test_malformed_token_returns_400_not_500(self):
        resp = self.client.post("/api/auth/password-reset/confirm/", {"token": "not-a-uuid", "password": "BrandNewPass99"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_unknown_token_rejected(self):
        resp = self.client.post(
            "/api/auth/password-reset/confirm/",
            {"token": "00000000-0000-0000-0000-000000000000", "password": "BrandNewPass99"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
