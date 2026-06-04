from django.conf import settings
from django.db import models


class Payment(models.Model):
    class Status(models.TextChoices):
        PAID = "paid", "Paid"
        UNPAID = "unpaid", "Unpaid"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    class Kind(models.TextChoices):
        INVOICE = "invoice", "Invoice"
        DEPOSIT = "deposit", "Deposit"
        CARD_ON_FILE = "card_on_file", "Card on file"
        FULL_PAYMENT = "full_payment", "Full payment"

    class Provider(models.TextChoices):
        STRIPE = "stripe", "Stripe"
        SQUARE = "square", "Square"
        MANUAL = "manual", "Manual"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payments")
    clinic = models.ForeignKey("core.Clinic", on_delete=models.CASCADE, related_name="payments", null=True, blank=True)
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="payments")
    appointment = models.ForeignKey(
        "appointments.Appointment",
        on_delete=models.SET_NULL,
        related_name="payments",
        null=True,
        blank=True,
    )
    kind = models.CharField(max_length=30, choices=Kind.choices, default=Kind.INVOICE)
    provider = models.CharField(max_length=30, choices=Provider.choices, default=Provider.MANUAL)
    stripe_payment_id = models.CharField(max_length=255, blank=True)
    stripe_checkout_session_id = models.CharField(max_length=255, blank=True)
    stripe_setup_intent_id = models.CharField(max_length=255, blank=True)
    stripe_customer_id = models.CharField(max_length=255, blank=True)
    checkout_url = models.URLField(blank=True)
    amount_cents = models.PositiveIntegerField()
    currency = models.CharField(max_length=3, default="CAD")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNPAID)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.client} - {self.amount_cents / 100:.2f} {self.currency}"
