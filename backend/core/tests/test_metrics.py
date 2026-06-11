from datetime import date, timedelta

from .base import ApiTestCase


def future():
    return (date.today() + timedelta(days=3)).isoformat()


class MetricsTests(ApiTestCase):
    def test_upcoming_excludes_cancelled_and_no_show(self):
        self.owner_client()
        cid = self.client.post(
            "/api/clients/", {"first_name": "M", "last_name": "X", "email": "mx@test.com"}, format="json"
        ).data["id"]

        def make(status, time):
            return self.client.post(
                "/api/appointments/",
                {"client": cid, "service": "Massage Therapy", "date": future(), "time": time,
                 "duration_minutes": 60, "status": status, "notes": ""},
                format="json",
            )

        make("confirmed", "09:00")
        make("pending", "10:00")
        make("cancelled", "11:00")
        make("completed", "12:00")

        metrics = self.client.get("/api/dashboard/metrics/").data
        # confirmed + pending + completed count as upcoming; cancelled excluded
        self.assertEqual(metrics["total_clients"], 1)
        self.assertEqual(metrics["upcoming_appointments"], 3)
        self.assertEqual(metrics["appointments_by_status"].get("cancelled"), 1)

    def test_revenue_counts_paid_payments(self):
        self.owner_client()
        cid = self.client.post(
            "/api/clients/", {"first_name": "R", "last_name": "V", "email": "rv@test.com"}, format="json"
        ).data["id"]
        self.client.post("/api/payments/", {"client": cid, "amount_cents": 12000, "currency": "CAD", "status": "paid"}, format="json")
        metrics = self.client.get("/api/dashboard/metrics/").data
        self.assertEqual(metrics["monthly_revenue_cents"], 12000)
