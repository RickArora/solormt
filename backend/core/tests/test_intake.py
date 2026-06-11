from datetime import date, timedelta

from django.core import mail
from django.test import override_settings
from django.utils import timezone

from core.models import IntakeResponse
from .base import ApiTestCase, LOCMEM_EMAIL


def next_weekday():
    d = date.today() + timedelta(days=2)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d.isoformat()


@override_settings(EMAIL_BACKEND=LOCMEM_EMAIL)
class IntakeAutoSendTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        _, self.clinic = self.owner_client()
        self.slug = self.clinic["slug"]
        self.initial = self.service_by_name(self.clinic, "Initial Assessment")  # requires_intake=True
        self.massage = self.service_by_name(self.clinic, "Massage Therapy")
        self.practitioner = self.first_practitioner(self.clinic)

    def _book(self, service_id, health_history="", time="10:00", email="c@test.com"):
        return self.client.post(
            f"/api/public/clinics/{self.slug}/book/",
            {
                "auth_mode": "register", "service_id": service_id, "practitioner_id": self.practitioner["id"],
                "date": next_weekday(), "time": time, "first_name": "Cara", "last_name": "Client",
                "email": email, "password": "ClientPass123", "phone": "416-555-0400",
                "health_history": health_history, "consent_accepted": True,
                "pay_deposit": False, "save_card": False, "sms_opt_in": False,
            },
            format="json",
        )

    def test_requires_intake_service_emails_a_link(self):
        resp = self._book(self.initial["id"], health_history="")
        self.assertEqual(resp.status_code, 201, resp.content)
        intake = IntakeResponse.objects.get(id=resp.data["intake_id"])
        self.assertEqual(intake.status, "sent")
        self.assertIsNone(intake.completed_at)
        # an email with the tokenized link went out
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(str(intake.token), mail.outbox[0].body)

    def test_inline_health_history_marks_completed_no_email(self):
        resp = self._book(self.initial["id"], health_history="bad shoulder")
        intake = IntakeResponse.objects.get(id=resp.data["intake_id"])
        self.assertEqual(intake.status, "completed")
        self.assertEqual(len(mail.outbox), 0)

    def test_non_requires_intake_service_no_email(self):
        resp = self._book(self.massage["id"], health_history="", time="14:00")
        self.assertEqual(len(mail.outbox), 0)
        intake = IntakeResponse.objects.get(id=resp.data["intake_id"])
        self.assertEqual(intake.status, "sent")  # created but not chased by email


class PublicIntakeTokenTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        _, self.clinic = self.owner_client()
        from core.models import Clinic
        from clients.models import Client
        self.clinic_obj = Clinic.objects.get(slug=self.clinic["slug"])
        self.client_obj = Client.objects.create(
            clinic=self.clinic_obj, owner=self.clinic_obj.owner, first_name="Tok", last_name="En", email="tok@test.com"
        )

    def _make_intake(self, expires_in_days=14, status="sent"):
        return IntakeResponse.objects.create(
            clinic=self.clinic_obj, client=self.client_obj, status=status,
            token_expires_at=timezone.now() + timedelta(days=expires_in_days),
        )

    def test_get_then_complete(self):
        intake = self._make_intake()
        self.client.credentials()  # public, no auth
        got = self.client.get(f"/api/public/intake/{intake.token}/")
        self.assertEqual(got.status_code, 200)
        self.assertFalse(got.data["completed"])
        self.assertTrue(got.data["editable"])

        posted = self.client.post(
            f"/api/public/intake/{intake.token}/",
            {"health_history": "all good", "consent_accepted": True}, format="json",
        )
        self.assertEqual(posted.status_code, 200)
        intake.refresh_from_db()
        self.assertEqual(intake.status, "completed")

    def test_one_time_use(self):
        intake = self._make_intake()
        self.client.credentials()
        self.client.post(f"/api/public/intake/{intake.token}/", {"health_history": "x", "consent_accepted": True}, format="json")
        again = self.client.post(f"/api/public/intake/{intake.token}/", {"health_history": "y", "consent_accepted": True}, format="json")
        self.assertEqual(again.status_code, 410)

    def test_expired_link_rejected_and_redacted(self):
        intake = self._make_intake(expires_in_days=-1)  # already expired
        self.client.credentials()
        got = self.client.get(f"/api/public/intake/{intake.token}/")
        self.assertTrue(got.data["expired"])
        self.assertFalse(got.data["editable"])
        posted = self.client.post(f"/api/public/intake/{intake.token}/", {"health_history": "x", "consent_accepted": True}, format="json")
        self.assertEqual(posted.status_code, 410)

    def test_completed_redacts_health_history_on_get(self):
        intake = self._make_intake()
        intake.health_history = "sensitive PHI"
        intake.status = "completed"
        intake.completed_at = timezone.now()
        intake.save()
        self.client.credentials()
        got = self.client.get(f"/api/public/intake/{intake.token}/")
        self.assertEqual(got.data["health_history"], "")  # redacted
        self.assertTrue(got.data["completed"])
