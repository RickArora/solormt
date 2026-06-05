from rest_framework import serializers

from .models import Client


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "date_of_birth",
            "emergency_contact",
            "notes",
            "insurance_company",
            "insurance_plan_number",
            "insurance_member_id",
            "insurance_group_number",
            "insurance_relationship",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

