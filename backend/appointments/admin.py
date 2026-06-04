from django.contrib import admin

from .models import Appointment


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ("client", "service", "date", "time", "status", "owner")
    list_filter = ("status", "date", "owner")
    search_fields = ("client__first_name", "client__last_name", "service")

