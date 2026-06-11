from datetime import date, timedelta

from .base import ApiTestCase


def next_weekday(offset_weeks=0):
    d = date.today() + timedelta(days=1 + offset_weeks * 7)
    while d.weekday() >= 5:  # Mon-Fri (default practitioner availability)
        d += timedelta(days=1)
    return d.isoformat()


class ClinicSettingsTests(ApiTestCase):
    def test_patch_settings(self):
        self.owner_client()
        resp = self.client.patch(
            "/api/clinic/",
            {
                "public_email": "hi@clinic.com",
                "public_phone": "416-555-0100",
                "address": "1 King St",
                "cancellation_window_hours": 48,
                "sms_enabled": True,
                "noshow_protection_enabled": True,
                "noshow_fee_cents": 5000,
                "reminder_email": "noreply@clinic.com",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["cancellation_window_hours"], 48)
        self.assertTrue(resp.data["sms_enabled"])
        self.assertTrue(resp.data["noshow_protection_enabled"])
        self.assertEqual(resp.data["noshow_fee_cents"], 5000)


class ServiceTests(ApiTestCase):
    def test_toggle_requires_intake(self):
        _, clinic = self.owner_client()
        svc = self.service_by_name(clinic, "Massage Therapy")
        resp = self.client.patch(f"/api/services/{svc['id']}/", {"requires_intake": True}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["requires_intake"])


class PractitionerScheduleTests(ApiTestCase):
    def test_create_practitioner_and_schedule(self):
        _, clinic = self.owner_client()
        svc = self.service_by_name(clinic, "Massage Therapy")
        resp = self.client.post(
            "/api/practitioners/",
            {"first_name": "Sam", "last_name": "Park", "service_ids": [svc["id"]], "is_active": True},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        pid = resp.data["id"]

        # Schedule settings
        patched = self.client.patch(
            f"/api/practitioners/{pid}/",
            {"slot_duration_minutes": 45, "buffer_minutes": 15, "slot_duration_options": [45, 60]},
            format="json",
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.data["slot_duration_minutes"], 45)
        self.assertEqual(patched.data["buffer_minutes"], 15)

        # Availability add + list + delete
        av = self.client.post(
            f"/api/practitioners/{pid}/availability/",
            {"weekday": 1, "start_time": "09:00", "end_time": "17:00", "is_active": True},
            format="json",
        )
        self.assertEqual(av.status_code, 201)
        listed = self.client.get(f"/api/practitioners/{pid}/availability/")
        self.assertEqual(len(listed.data), 1)
        deleted = self.client.delete(f"/api/practitioners/{pid}/availability/{av.data['id']}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(len(self.client.get(f"/api/practitioners/{pid}/availability/").data), 0)


class ClientAndProfileTests(ApiTestCase):
    def _create_client(self):
        return self.client.post(
            "/api/clients/",
            {"first_name": "Jane", "last_name": "Smith", "email": "jane@test.com", "phone": "416-555-0200"},
            format="json",
        ).data

    def test_create_and_list_client(self):
        self.owner_client()
        c = self._create_client()
        self.assertEqual(c["first_name"], "Jane")
        listed = self.client.get("/api/clients/")
        self.assertEqual(len(listed.data), 1)

    def test_profile_aggregates_records(self):
        _, clinic = self.owner_client()
        c = self._create_client()
        # an appointment, a soap note, a payment
        self.client.post(
            "/api/appointments/",
            {"client": c["id"], "service": "Massage Therapy", "date": next_weekday(), "time": "10:00",
             "duration_minutes": 60, "status": "confirmed", "notes": ""},
            format="json",
        )
        self.client.post(
            "/api/soap-notes/",
            {"client": c["id"], "subjective": "tight neck", "objective": "ROM limited", "assessment": "tension",
             "plan": "weekly", "is_complete": False},
            format="json",
        )
        self.client.post(
            "/api/payments/",
            {"client": c["id"], "amount_cents": 12000, "currency": "CAD", "status": "paid"},
            format="json",
        )
        profile = self.client.get(f"/api/clients/{c['id']}/profile/")
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(len(profile.data["appointments"]), 1)
        self.assertEqual(len(profile.data["soap_notes"]), 1)
        self.assertEqual(len(profile.data["payments"]), 1)
        self.assertIn("reminders", profile.data)


class AppointmentTests(ApiTestCase):
    def _client_id(self):
        return self.client.post(
            "/api/clients/", {"first_name": "A", "last_name": "B", "email": "ab@test.com"}, format="json"
        ).data["id"]

    def test_create_update_delete(self):
        self.owner_client()
        cid = self._client_id()
        created = self.client.post(
            "/api/appointments/",
            {"client": cid, "service": "Massage Therapy", "date": next_weekday(), "time": "11:00",
             "duration_minutes": 60, "status": "pending", "notes": ""},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        aid = created.data["id"]

        patched = self.client.patch(f"/api/appointments/{aid}/", {"status": "confirmed"}, format="json")
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.data["status"], "confirmed")

        deleted = self.client.delete(f"/api/appointments/{aid}/")
        self.assertEqual(deleted.status_code, 204)

    def test_mark_no_show_creates_fee_when_enabled(self):
        self.owner_client()
        self.client.patch("/api/clinic/", {"noshow_protection_enabled": True, "noshow_fee_cents": 4000}, format="json")
        cid = self._client_id()
        aid = self.client.post(
            "/api/appointments/",
            {"client": cid, "service": "Massage Therapy", "date": next_weekday(), "time": "12:00",
             "duration_minutes": 60, "status": "confirmed", "notes": ""},
            format="json",
        ).data["id"]

        resp = self.client.post(f"/api/appointments/{aid}/no-show/", {}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["appointment"]["status"], "no_show")
        self.assertTrue(resp.data["no_show_fee_created"])
        self.assertEqual(resp.data["fee_cents"], 4000)
        # a matching unpaid payment exists
        payments = self.client.get("/api/payments/").data
        self.assertTrue(any(p["amount_cents"] == 4000 and p["status"] == "unpaid" for p in payments))
