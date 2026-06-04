from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import UserProfile

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=UserProfile.Role.choices, default=UserProfile.Role.CLINIC_OWNER)
    clinic_name = serializers.CharField(max_length=160, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["id", "email", "password", "first_name", "last_name", "role", "clinic_name"]
        read_only_fields = ["id"]

    def validate_email(self, value: str) -> str:
        normalized = value.lower().strip()
        if User.objects.filter(email=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized

    @transaction.atomic
    def create(self, validated_data):
        role = validated_data.pop("role")
        clinic_name = validated_data.pop("clinic_name", "")
        password = validated_data.pop("password")
        email = validated_data.pop("email")
        user = User.objects.create_user(username=email, email=email, password=password, **validated_data)
        UserProfile.objects.create(user=user, role=role, clinic_name=clinic_name)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)

    class Meta:
        model = UserProfile
        fields = ["email", "first_name", "last_name", "role", "clinic_name", "phone_number"]

