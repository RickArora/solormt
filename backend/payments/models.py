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


class InsuranceClaim(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"
        PAID = "paid", "Paid"

    class Provider(models.TextChoices):
        TELUS = "telus", "TELUS eClaims"
        MANUAL = "manual", "Manual / Paper"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="insurance_claims")
    clinic = models.ForeignKey("core.Clinic", on_delete=models.CASCADE, related_name="insurance_claims")
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="insurance_claims")
    appointment = models.ForeignKey(
        "appointments.Appointment", on_delete=models.SET_NULL, null=True, blank=True, related_name="insurance_claims"
    )
    payment = models.ForeignKey(Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name="insurance_claims")
    provider = models.CharField(max_length=20, choices=Provider.choices, default=Provider.TELUS)
    claim_number = models.CharField(max_length=80, blank=True)
    service_date = models.DateField()
    diagnosis_code = models.CharField(max_length=20, blank=True)
    service_code = models.CharField(max_length=20, blank=True, default="21000")  # Standard RMT service code
    amount_submitted_cents = models.PositiveIntegerField()
    amount_approved_cents = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    response_message = models.TextField(blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Claim {self.claim_number or self.pk} – {self.client} ({self.get_status_display()})"
