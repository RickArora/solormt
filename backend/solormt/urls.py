from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from appointments.views import AppointmentViewSet
from clients.views import ClientViewSet
from core.views import (
    ClientAppointmentActionView,
    ClientPackageListView,
    ClientPortalAuthView,
    ClientPortalView,
    ClinicDetailView,
    InsuranceClaimListView,
    IntakeResponseListView,
    MarkNoShowView,
    PackageListView,
    PractitionerAvailabilityView,
    PractitionerListView,
    PublicAvailabilityView,
    PublicBookingView,
    PublicClinicView,
    RedeemPackageSessionView,
    RegisterView,
    ServiceListView,
    SubmitInsuranceClaimView,
    UserProfileView,
    WaitlistEntryDetailView,
    WaitlistView,
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
    path("api/practitioners/", PractitionerListView.as_view(), name="practitioners"),
    path("api/practitioners/<int:practitioner_id>/availability/", PractitionerAvailabilityView.as_view(), name="practitioner-availability"),
    path("api/intake-responses/", IntakeResponseListView.as_view(), name="intake-responses"),
    path("api/public/clinics/<slug:clinic_slug>/", PublicClinicView.as_view(), name="public-clinic"),
    path("api/public/clinics/<slug:clinic_slug>/availability/", PublicAvailabilityView.as_view(), name="public-availability"),
    path("api/public/clinics/<slug:clinic_slug>/book/", PublicBookingView.as_view(), name="public-book"),
    path("api/public/clinics/<slug:clinic_slug>/portal/auth/", ClientPortalAuthView.as_view(), name="client-portal-auth"),
    path("api/client/clinics/<slug:clinic_slug>/portal/", ClientPortalView.as_view(), name="client-portal"),
    path(
        "api/client/clinics/<slug:clinic_slug>/appointments/<int:appointment_id>/<str:action>/",
        ClientAppointmentActionView.as_view(),
        name="client-appointment-action",
    ),
    path("api/dashboard/metrics/", DashboardMetricsView.as_view(), name="dashboard-metrics"),
    path("api/payments/checkout/", StripeCheckoutView.as_view(), name="stripe-checkout"),
    path("api/payments/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
    # Waitlist
    path("api/waitlist/", WaitlistView.as_view(), name="waitlist"),
    path("api/waitlist/<int:entry_id>/", WaitlistEntryDetailView.as_view(), name="waitlist-entry"),
    # No-show
    path("api/appointments/<int:appointment_id>/no-show/", MarkNoShowView.as_view(), name="mark-no-show"),
    # Packages / memberships
    path("api/packages/", PackageListView.as_view(), name="packages"),
    path("api/client-packages/", ClientPackageListView.as_view(), name="client-packages"),
    path("api/client-packages/<int:client_package_id>/redeem/", RedeemPackageSessionView.as_view(), name="redeem-package"),
    # Insurance / TELUS eClaims
    path("api/insurance-claims/", InsuranceClaimListView.as_view(), name="insurance-claims"),
    path("api/insurance-claims/<int:claim_id>/submit/", SubmitInsuranceClaimView.as_view(), name="submit-insurance-claim"),
]
