from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from appointments.views import AppointmentViewSet
from clients.views import ClientViewSet
from core.views import (
    ClinicDetailView,
    IntakeResponseListView,
    PublicAvailabilityView,
    PublicBookingView,
    PublicClinicView,
    RegisterView,
    ServiceListView,
    UserProfileView,
)
from dashboard.views import DashboardMetricsView
from payments.views import PaymentViewSet, StripeCheckoutView, StripeWebhookView
from soap_notes.views import SoapNoteViewSet

router = DefaultRouter()
router.register("clients", ClientViewSet, basename="client")
router.register("appointments", AppointmentViewSet, basename="appointment")
router.register("soap-notes", SoapNoteViewSet, basename="soap-note")
router.register("payments", PaymentViewSet, basename="payment")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/me/", UserProfileView.as_view(), name="user-profile"),
    path("api/clinic/", ClinicDetailView.as_view(), name="clinic-detail"),
    path("api/services/", ServiceListView.as_view(), name="services"),
    path("api/intake-responses/", IntakeResponseListView.as_view(), name="intake-responses"),
    path("api/public/clinics/<slug:clinic_slug>/", PublicClinicView.as_view(), name="public-clinic"),
    path("api/public/clinics/<slug:clinic_slug>/availability/", PublicAvailabilityView.as_view(), name="public-availability"),
    path("api/public/clinics/<slug:clinic_slug>/book/", PublicBookingView.as_view(), name="public-book"),
    path("api/dashboard/metrics/", DashboardMetricsView.as_view(), name="dashboard-metrics"),
    path("api/payments/checkout/", StripeCheckoutView.as_view(), name="stripe-checkout"),
    path("api/payments/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
]
