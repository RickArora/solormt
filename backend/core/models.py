from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Clinic(models.Model):
    class PaymentProvider(models.TextChoices):
        STRIPE = "stripe", "Stripe"
        SQUARE = "square", "Square"

    class BookingPaymentMode(models.TextChoices):
        NONE = "none", "No payment required"
        DEPOSIT = "deposit", "Deposit"
        CARD_ON_FILE = "card_on_file", "Card on file"
        FULL_PAYMENT = "full_payment", "Full payment"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_clinics")
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True)
    public_email = models.EmailField(blank=True)
    public_phone = models.CharField(max_length=40, blank=True)
    address = models.CharField(max_length=255, blank=True)
    booking_policy = models.TextField(
        default="Appointments can be rescheduled or cancelled up to 24 hours before the start time."
    )
    cancellation_window_hours = models.PositiveIntegerField(default=24)
    deposit_required = models.BooleanField(default=False)
    deposit_amount_cents = models.PositiveIntegerField(default=0)
    payment_provider = models.CharField(max_length=20, choices=PaymentProvider.choices, default=PaymentProvider.STRIPE)
    booking_payment_mode = models.CharField(
        max_length=30,
        choices=BookingPaymentMode.choices,
        default=BookingPaymentMode.NONE,
    )
    card_on_file_required = models.BooleanField(default=False)
    reminders_enabled = models.BooleanField(default=True)
    reminder_email = models.EmailField(blank=True, help_text="From address for outgoing reminder emails")
    sms_enabled = models.BooleanField(default=False)
    noshow_protection_enabled = models.BooleanField(default=False)
    noshow_fee_cents = models.PositiveIntegerField(default=5000, help_text="Fee charged when client no-shows")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name) or "clinic"
            slug = base_slug
            counter = 2
            while Clinic.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class ClinicMembership(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        PRACTITIONER = "practitioner", "Practitioner"
        ADMIN = "admin", "Admin"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="clinic_memberships")
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=30, choices=Role.choices, default=Role.OWNER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "clinic")

    def __str__(self) -> str:
        return f"{self.user.email} - {self.clinic} ({self.get_role_display()})"


class Service(models.Model):
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="services")
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    duration_minutes = models.PositiveIntegerField(default=60)
    price_cents = models.PositiveIntegerField(default=12000)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["duration_minutes", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.clinic})"


class Practitioner(models.Model):
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="practitioners")
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    display_name = models.CharField(max_length=160, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    bio = models.TextField(blank=True)
    services = models.ManyToManyField(Service, related_name="practitioners", blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    @property
    def name(self) -> str:
        return self.display_name or f"{self.first_name} {self.last_name}".strip()

    def __str__(self) -> str:
        return self.name


class PractitionerAvailability(models.Model):
    class Weekday(models.IntegerChoices):
        MONDAY = 0, "Monday"
        TUESDAY = 1, "Tuesday"
        WEDNESDAY = 2, "Wednesday"
        THURSDAY = 3, "Thursday"
        FRIDAY = 4, "Friday"
        SATURDAY = 5, "Saturday"
        SUNDAY = 6, "Sunday"

    practitioner = models.ForeignKey(Practitioner, on_delete=models.CASCADE, related_name="availability")
    weekday = models.PositiveSmallIntegerField(choices=Weekday.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["weekday", "start_time"]

    def __str__(self) -> str:
        return f"{self.practitioner} {self.get_weekday_display()} {self.start_time}-{self.end_time}"


class IntakeTemplate(models.Model):
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="intake_templates")
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.clinic})"


class IntakeResponse(models.Model):
    class Status(models.TextChoices):
        SENT = "sent", "Sent"
        COMPLETED = "completed", "Completed"
        NEEDS_REVIEW = "needs_review", "Needs review"

    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="intake_responses")
    template = models.ForeignKey(IntakeTemplate, on_delete=models.SET_NULL, null=True, blank=True)
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="intake_responses")
    appointment = models.ForeignKey(
        "appointments.Appointment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="intake_responses",
    )
    health_history = models.TextField(blank=True)
    consent_accepted = models.BooleanField(default=False)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.SENT)
    answers = models.JSONField(default=dict, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Intake response for {self.client}"


class UserProfile(models.Model):
    class Role(models.TextChoices):
        CLINIC_OWNER = "clinic_owner", "Clinic Owner"
        PRACTITIONER = "practitioner", "Practitioner"
        ADMIN = "admin", "Admin"
        CLIENT = "client", "Client"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=30, choices=Role.choices, default=Role.CLINIC_OWNER)
    clinic_name = models.CharField(max_length=160, blank=True)
    phone_number = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.user.email} ({self.get_role_display()})"


class WaitlistEntry(models.Model):
    class Status(models.TextChoices):
        WAITING = "waiting", "Waiting"
        NOTIFIED = "notified", "Notified"
        BOOKED = "booked", "Booked"
        EXPIRED = "expired", "Expired"

    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="waitlist_entries")
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="waitlist_entries")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="waitlist_entries")
    practitioner = models.ForeignKey(Practitioner, on_delete=models.SET_NULL, null=True, blank=True, related_name="waitlist_entries")
    preferred_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.WAITING)
    notified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.client} on waitlist for {self.service}"


class Package(models.Model):
    """A reusable treatment package template the clinic creates and sells."""
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="packages")
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True, related_name="packages")
    sessions = models.PositiveIntegerField(default=5)
    validity_days = models.PositiveIntegerField(default=365, help_text="Days from purchase before package expires")
    price_cents = models.PositiveIntegerField(default=50000)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.sessions} sessions)"


class ClientPackage(models.Model):
    """A purchased package instance belonging to a specific client."""
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        EXHAUSTED = "exhausted", "Exhausted"
        EXPIRED = "expired", "Expired"
        CANCELLED = "cancelled", "Cancelled"

    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="client_packages")
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="packages")
    package = models.ForeignKey(Package, on_delete=models.SET_NULL, null=True, related_name="client_instances")
    package_name = models.CharField(max_length=160)
    sessions_total = models.PositiveIntegerField()
    sessions_used = models.PositiveIntegerField(default=0)
    price_cents = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    purchased_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateField(null=True, blank=True)
    payment = models.ForeignKey("payments.Payment", on_delete=models.SET_NULL, null=True, blank=True, related_name="packages")

    class Meta:
        ordering = ["-purchased_at"]

    @property
    def sessions_remaining(self) -> int:
        return max(0, self.sessions_total - self.sessions_used)

    def __str__(self) -> str:
        return f"{self.client} – {self.package_name} ({self.sessions_remaining} left)"


class AppointmentReminder(models.Model):
    class Kind(models.TextChoices):
        CONFIRMATION = "confirmation", "Confirmation"
        FORTY_EIGHT_HOUR = "48_hour", "48 hour reminder"
        SAME_DAY = "same_day", "Same day reminder"

    class Channel(models.TextChoices):
        EMAIL = "email", "Email"
        SMS = "sms", "SMS"

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        SENT = "sent", "Sent"
        CANCELLED = "cancelled", "Cancelled"

    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="reminders")
    appointment = models.ForeignKey("appointments.Appointment", on_delete=models.CASCADE, related_name="reminders")
    kind = models.CharField(max_length=30, choices=Kind.choices)
    channel = models.CharField(max_length=20, choices=Channel.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    scheduled_for = models.DateTimeField()
    message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["scheduled_for"]
        unique_together = ("appointment", "kind", "channel")

    def __str__(self) -> str:
        return f"{self.get_kind_display()} for {self.appointment}"
