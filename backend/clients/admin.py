from django.contrib import admin

from .models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "email", "phone", "owner")
    search_fields = ("first_name", "last_name", "email", "phone")
    list_filter = ("owner",)

