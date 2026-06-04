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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"
