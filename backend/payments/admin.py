from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("client", "amount_cents", "currency", "status", "owner", "created_at")
    list_filter = ("status", "currency", "owner")
    search_fields = ("client__first_name", "client__last_name", "stripe_payment_id", "stripe_checkout_session_id")

