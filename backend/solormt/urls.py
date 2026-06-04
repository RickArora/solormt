from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from appointments.views import AppointmentViewSet
from clients.views import ClientViewSet
from core.views import RegisterView, UserProfileView
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
    path("api/dashboard/metrics/", DashboardMetricsView.as_view(), name="dashboard-metrics"),
    path("api/payments/checkout/", StripeCheckoutView.as_view(), name="stripe-checkout"),
    path("api/payments/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
]
