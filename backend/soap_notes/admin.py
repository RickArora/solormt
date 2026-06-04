from django.contrib import admin

from .models import SoapNote


@admin.register(SoapNote)
class SoapNoteAdmin(admin.ModelAdmin):
    list_display = ("client", "appointment", "is_complete", "updated_at", "owner")
    list_filter = ("is_complete", "owner")
    search_fields = ("client__first_name", "client__last_name", "assessment", "plan")

