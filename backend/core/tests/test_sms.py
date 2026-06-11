from datetime import date, timedelta

from django.core import mail
from django.core.management import call_command
from django.test import override_settings

from clients.models import Client
from core.models import Clinic
from .base import ApiTestCase, LOCMEM_EMAIL


def next_weekday():
    d = date.today() + timedelta(days=2)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d.isoformat()


class SmsWebhookTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        _, self.clinic = self.owner_client()
        clinic = Clinic.objects.get(slug=self.clinic["slug"])
        self.client_obj = Client.objects.create(
            clinic=clinic, owner=clinic.owner, first_name="Tex", last_name="Ter",
            email="tex@test.com", phone="+1 (416) 555-7777", sms_opt_in=True,
        )
        self.client.credentials()  # webhook is public

    def test_stop_opts_out(self):
        resp = self.client.post("/api/sms/webhook/", {"From": "+14165557777", "Body": "STOP"})
        self.assertEqual(resp.status_code, 200)
        self.client_obj.refresh_from_db()
        self.assertFalse(self.client_obj.sms_opt_in)
        self.assertIsNotNone(self.client_obj.sms_opt_out_at)

    def test_start_resubscribes(self):
        self.client_obj.sms_opt_in = False
        self.client_obj.save()
        self.client.post("/api/sms/webhook/", {"From": "+14165557777", "Body": "START"})
        self.client_obj.refresh_from_db()
        self.assertTrue(self.client_obj.sms_opt_in)


@override_settings(EMAIL_BACKEND=LOCMEM_EMAIL)
class ReminderCommandTests(ApiTestCase):
    def test_send_reminders_processes_queue(self):
        _, clinic = self.owner_client()
        slug = clinic["slug"]
        massage = self.service_by_name(clinic, "Massage Therapy")
        practitioner = self.first_practitioner(clinic)
        # booking queues confirmation + 48h + same-day reminders
        self.client.post(
            f"/api/public/clinics/{slug}/book/",
            {"auth_mode": "register", "service_id": massage["id"], "practitioner_id": practitioner["id"],
             "date": next_weekday(), "time": "10:00", "first_name": "Rem", "last_name": "Inder",
             "email": "rem@test.com", "password": "ReminderPass123", "phone": "", "health_history": "x",
             "consent_accepted": True, "pay_deposit": False, "save_card": False, "sms_opt_in": False},
            format="json",
        )
        mail.outbox.clear()
        # should run without error and send at least the due confirmation email
        call_command("send_reminders")
        self.assertTrue(len(mail.outbox) >= 1)
