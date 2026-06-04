from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.models import UserProfile


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

        self.stdout.write(self.style.SUCCESS("Admin ready: admin@solormt.local / Admin12345!"))
