from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.models import Clinic, ClinicMembership, UserProfile
from core.utils import ensure_clinic_defaults


class Command(BaseCommand):
    help = "Create a local development admin account."

    def handle(self, *args, **options):
        User = get_user_model()
        email = "admin@solormt.local"
        password = "Admin12345!"
        user, created = User.objects.get_or_create(
            username=email,
            defaults={
                "email": email,
                "first_name": "SoloRMT",
                "last_name": "Admin",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            user.set_password(password)
            user.save()
        else:
            user.is_staff = True
            user.is_superuser = True
            user.email = email
            user.save(update_fields=["is_staff", "is_superuser", "email"])

        UserProfile.objects.get_or_create(
            user=user,
            defaults={"role": UserProfile.Role.ADMIN, "clinic_name": "SoloRMT Demo Clinic"},
        )
        clinic, _ = Clinic.objects.get_or_create(
            owner=user,
            slug="demo-clinic",
            defaults={
                "name": "SoloRMT Demo Clinic",
                "public_email": "admin@solormt.local",
                "public_phone": "416-555-0100",
                "address": "123 Wellness Ave, Toronto, ON",
                "deposit_required": True,
                "deposit_amount_cents": 2500,
                "booking_payment_mode": Clinic.BookingPaymentMode.DEPOSIT,
                "card_on_file_required": False,
                "payment_provider": Clinic.PaymentProvider.STRIPE,
            },
        )
        clinic.booking_payment_mode = Clinic.BookingPaymentMode.DEPOSIT
        clinic.card_on_file_required = False
        clinic.payment_provider = Clinic.PaymentProvider.STRIPE
        clinic.deposit_required = True
        clinic.deposit_amount_cents = 2500
        clinic.save(
            update_fields=[
                "booking_payment_mode",
                "card_on_file_required",
                "payment_provider",
                "deposit_required",
                "deposit_amount_cents",
                "updated_at",
            ]
        )
        ClinicMembership.objects.get_or_create(user=user, clinic=clinic, defaults={"role": ClinicMembership.Role.OWNER})
        ensure_clinic_defaults(clinic)
        user.clients.filter(clinic__isnull=True).update(clinic=clinic)
        user.appointments.filter(clinic__isnull=True).update(clinic=clinic)
        user.soap_notes.filter(clinic__isnull=True).update(clinic=clinic)
        user.payments.filter(clinic__isnull=True).update(clinic=clinic)

        self.stdout.write(self.style.SUCCESS("Admin ready: admin@solormt.local / Admin12345!"))
        self.stdout.write(self.style.SUCCESS("Demo clinic ready: /app/demo-clinic and /book/demo-clinic"))
