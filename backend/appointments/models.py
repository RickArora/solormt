from django.conf import settings
from django.db import models


class Appointment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="appointments")
    clinic = models.ForeignKey("core.Clinic", on_delete=models.CASCADE, related_name="appointments", null=True, blank=True)
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="appointments")
    service_ref = models.ForeignKey("core.Service", on_delete=models.SET_NULL, null=True, blank=True)
    practitioner = models.ForeignKey("core.Practitioner", on_delete=models.SET_NULL, null=True, blank=True, related_name="appointments")
    service = models.CharField(max_length=160)
    date = models.DateField()
    time = models.TimeField()
    duration_minutes = models.PositiveIntegerField(default=60)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date", "time"]

    def __str__(self) -> str:
        return f"{self.client} - {self.date} {self.time}"
