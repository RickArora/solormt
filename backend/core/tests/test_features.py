from datetime import date, timedelta

from django.core import mail
from django.test import override_settings

from core.models import WaitlistEntry
from .base import ApiTestCase, LOCMEM_EMAIL


def next_weekday():
    d = date.today() + timedelta(days=2)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d.isoformat()


class WaitlistTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        _, self.clinic = self.owner_client()
        self.massage = self.service_by_name(self.clinic, "Massage Therapy")
        self.cid = self.client.post(
            "/api/clients/", {"first_name": "Will", "last_name": "Wait", "email": "will@test.com"}, format="json"
        ).data["id"]

    def test_create_list_delete(self):
        created = self.client.post(
            "/api/waitlist/",
            {"client": self.cid, "service": self.massage["id"], "notes": "flexible"},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(created.data["status"], "waiting")
        self.assertEqual(len(self.client.get("/api/waitlist/").data), 1)
        self.assertEqual(self.client.delete(f"/api/waitlist/{created.data['id']}/").status_code, 204)

    @override_settings(EMAIL_BACKEND=LOCMEM_EMAIL)
    def test_cancellation_notifies_waitlist(self):
        # client with email on the waitlist for massage
        self.client.patch(f"/api/clients/{self.cid}/", {"email": "will@test.com"}, format="json")
        self.client.post("/api/waitlist/", {"client": self.cid, "service": self.massage["id"]}, format="json")

        # book + then cancel an appointment for that service via the client portal action
        # simplest path: create appointment with service_ref through public booking
        _, clinic = self.clinic, self.clinic
        slug = clinic["slug"]
        practitioner = self.first_practitioner(clinic)
        book = self.client.post(
            f"/api/public/clinics/{slug}/book/",
            {"auth_mode": "register", "service_id": self.massage["id"], "practitioner_id": practitioner["id"],
             "date": next_weekday(), "time": "10:00", "first_name": "Book", "last_name": "Er",
             "email": "booker@test.com", "password": "BookerPass123", "phone": "", "health_history": "x",
             "consent_accepted": True, "pay_deposit": False, "save_card": False, "sms_opt_in": False},
            format="json",
        )
        self.assertEqual(book.status_code, 201, book.content)
        mail.outbox.clear()

        # cancel it via the owner API (delete) won't notify; use the client portal cancel.
        client_token = book.data["client_access"]
        appt_id = book.data["appointment_id"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {client_token}")
        cancelled = self.client.post(
            f"/api/client/clinics/{slug}/appointments/{appt_id}/cancel/", {}, format="json"
        )
        self.assertEqual(cancelled.status_code, 200, cancelled.content)
        # the waitlisted client (will@test.com) should have been emailed
        self.assertTrue(any("will@test.com" in m.to for m in mail.outbox))
        entry = WaitlistEntry.objects.get(client_id=self.cid)
        self.assertEqual(entry.status, "notified")


class PackageTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        _, self.clinic = self.owner_client()
        self.massage = self.service_by_name(self.clinic, "Massage Therapy")
        self.cid = self.client.post(
            "/api/clients/", {"first_name": "Pat", "last_name": "Pack", "email": "pat@test.com"}, format="json"
        ).data["id"]

    def test_create_sell_and_redeem(self):
        pkg = self.client.post(
            "/api/packages/",
            {"name": "5-Pack", "sessions": 5, "validity_days": 180, "price_cents": 55000, "service": self.massage["id"], "is_active": True},
            format="json",
        )
        self.assertEqual(pkg.status_code, 201, pkg.content)

        purchase = self.client.post(
            "/api/client-packages/", {"package_id": pkg.data["id"], "client_id": self.cid}, format="json"
        )
        self.assertEqual(purchase.status_code, 201, purchase.content)
        cpid = purchase.data["id"]
        self.assertEqual(purchase.data["sessions_remaining"], 5)
        # purchase created a payment
        self.assertTrue(self.client.get("/api/payments/").data)

        redeem = self.client.post(f"/api/client-packages/{cpid}/redeem/", {}, format="json")
        self.assertEqual(redeem.status_code, 200)
        self.assertEqual(redeem.data["sessions_used"], 1)
        self.assertEqual(redeem.data["sessions_remaining"], 4)

    def test_exhaustion(self):
        pkg = self.client.post(
            "/api/packages/", {"name": "1-Pack", "sessions": 1, "validity_days": 30, "price_cents": 12000, "is_active": True}, format="json"
        ).data
        cpid = self.client.post("/api/client-packages/", {"package_id": pkg["id"], "client_id": self.cid}, format="json").data["id"]
        self.client.post(f"/api/client-packages/{cpid}/redeem/", {}, format="json")
        # second redeem should fail (no sessions left)
        again = self.client.post(f"/api/client-packages/{cpid}/redeem/", {}, format="json")
        self.assertEqual(again.status_code, 400)


class InsuranceClaimTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        _, self.clinic = self.owner_client()
        self.cid = self.client.post(
            "/api/clients/", {"first_name": "Ins", "last_name": "Ured", "email": "ins@test.com"}, format="json"
        ).data["id"]

    def test_create_draft_and_submit(self):
        draft = self.client.post(
            "/api/insurance-claims/",
            {"client": self.cid, "provider": "telus", "service_date": date.today().isoformat(),
             "service_code": "21000", "amount_submitted_cents": 12000},
            format="json",
        )
        self.assertEqual(draft.status_code, 201, draft.content)
        self.assertEqual(draft.data["status"], "draft")

        submitted = self.client.post(f"/api/insurance-claims/{draft.data['id']}/submit/", {}, format="json")
        self.assertEqual(submitted.status_code, 200)
        self.assertEqual(submitted.data["status"], "submitted")
        self.assertTrue(submitted.data["claim_number"])
