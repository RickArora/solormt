from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Clinic(models.Model):
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
    reminders_enabled = models.BooleanField(default=True)
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
    answers = models.JSONField(default=dict, blank=True)
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

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=30, choices=Role.choices, default=Role.CLINIC_OWNER)
    clinic_name = models.CharField(max_length=160, blank=True)
    phone_number = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.user.email} ({self.get_role_display()})"
