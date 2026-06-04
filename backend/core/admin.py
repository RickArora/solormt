from django.contrib import admin

from .models import (
    AppointmentReminder,
    Clinic,
    ClinicMembership,
    IntakeResponse,
    IntakeTemplate,
    Practitioner,
    PractitionerAvailability,
    Service,
    UserProfile,
)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "clinic_name", "phone_number")
    list_filter = ("role",)
    search_fields = ("user__email", "clinic_name")


@admin.register(Clinic)
class ClinicAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "owner", "public_email", "public_phone", "deposit_required")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name", "slug", "owner__email")


@admin.register(ClinicMembership)
class ClinicMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "clinic", "role")
    list_filter = ("role", "clinic")
    search_fields = ("user__email", "clinic__name")


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "clinic", "duration_minutes", "price_cents", "is_active")
    list_filter = ("clinic", "is_active")


@admin.register(Practitioner)
class PractitionerAdmin(admin.ModelAdmin):
    list_display = ("name", "clinic", "email", "is_active")
    list_filter = ("clinic", "is_active")
    search_fields = ("first_name", "last_name", "display_name", "clinic__name")
    filter_horizontal = ("services",)


@admin.register(PractitionerAvailability)
class PractitionerAvailabilityAdmin(admin.ModelAdmin):
    list_display = ("practitioner", "weekday", "start_time", "end_time", "is_active")
    list_filter = ("weekday", "is_active")


@admin.register(IntakeTemplate)
class IntakeTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "clinic", "is_active")
    list_filter = ("clinic", "is_active")


@admin.register(IntakeResponse)
class IntakeResponseAdmin(admin.ModelAdmin):
    list_display = ("client", "clinic", "appointment", "status", "consent_accepted", "created_at")
    list_filter = ("clinic", "status", "consent_accepted")


@admin.register(AppointmentReminder)
class AppointmentReminderAdmin(admin.ModelAdmin):
    list_display = ("appointment", "clinic", "kind", "channel", "status", "scheduled_for")
    list_filter = ("kind", "channel", "status")
