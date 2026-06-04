from .models import Clinic, ClinicMembership, IntakeTemplate, Service


def get_default_clinic(user):
    membership = ClinicMembership.objects.select_related("clinic").filter(user=user).first()
    if membership:
        return membership.clinic

    profile = getattr(user, "profile", None)
    name = getattr(profile, "clinic_name", "") or f"{user.first_name or user.username} Clinic"
    clinic = Clinic.objects.create(owner=user, name=name)
    ClinicMembership.objects.create(user=user, clinic=clinic, role=ClinicMembership.Role.OWNER)
    ensure_clinic_defaults(clinic)
    return clinic


def ensure_clinic_defaults(clinic):
    if not clinic.services.exists():
        Service.objects.bulk_create(
            [
                Service(clinic=clinic, name="Massage Therapy", duration_minutes=60, price_cents=12000),
                Service(clinic=clinic, name="Initial Assessment", duration_minutes=75, price_cents=15000),
                Service(clinic=clinic, name="Follow-up Treatment", duration_minutes=45, price_cents=9500),
            ]
        )
    if not clinic.intake_templates.exists():
        IntakeTemplate.objects.create(
            clinic=clinic,
            name="New Client Intake + Consent",
            description="Health history, treatment consent, and clinic policy acknowledgement.",
        )
