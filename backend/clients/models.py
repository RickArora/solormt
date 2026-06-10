from django.conf import settings
from django.db import models


class Client(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="clients")
    clinic = models.ForeignKey("core.Clinic", on_delete=models.CASCADE, related_name="clients", null=True, blank=True)
    portal_user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="portal_client",
        null=True,
        blank=True,
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    emergency_contact = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    # SMS reminder consent (CASL/TCPA). SMS only goes out when this is True.
    sms_opt_in = models.BooleanField(default=False)
    sms_opt_out_at = models.DateTimeField(null=True, blank=True)
    # Insurance / TELUS eClaims fields
    insurance_company = models.CharField(max_length=160, blank=True)
    insurance_plan_number = models.CharField(max_length=80, blank=True)
    insurance_member_id = models.CharField(max_length=80, blank=True)
    insurance_group_number = models.CharField(max_length=80, blank=True)
    insurance_relationship = models.CharField(
        max_length=20,
        blank=True,
        choices=[("self", "Self"), ("spouse", "Spouse"), ("dependent", "Dependent")],
        default="self",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"
