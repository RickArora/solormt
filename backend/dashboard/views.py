from datetime import date

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from appointments.models import Appointment
from clients.models import Client
from payments.models import Payment
from soap_notes.models import SoapNote
from core.utils import get_default_clinic


class DashboardMetricsView(APIView):
    def get(self, request):
        user = request.user
        clinic = get_default_clinic(user)
        today = timezone.localdate()
        month_start = date(today.year, today.month, 1)

        monthly_revenue = (
            Payment.objects.filter(owner=user, clinic=clinic, status=Payment.Status.PAID, created_at__date__gte=month_start)
            .aggregate(total=Sum("amount_cents"))
            .get("total")
            or 0
        )
        outstanding = (
            Payment.objects.filter(owner=user, clinic=clinic, status=Payment.Status.UNPAID)
            .aggregate(total=Sum("amount_cents"))
            .get("total")
            or 0
        )
        completed_notes = SoapNote.objects.filter(owner=user, clinic=clinic, is_complete=True).count()
        total_notes = SoapNote.objects.filter(owner=user, clinic=clinic).count()

        upcoming = (
            Appointment.objects.filter(owner=user, clinic=clinic, date__gte=today)
            .values("status")
            .annotate(count=Count("id"))
        )

        return Response(
            {
                "total_clients": Client.objects.filter(owner=user, clinic=clinic).count(),
                "upcoming_appointments": sum(item["count"] for item in upcoming),
                "appointments_by_status": {item["status"]: item["count"] for item in upcoming},
                "monthly_revenue_cents": monthly_revenue,
                "outstanding_invoices_cents": outstanding,
                "soap_notes_completed": completed_notes,
                "soap_completion_rate": round((completed_notes / total_notes) * 100, 1) if total_notes else 0,
            }
        )
