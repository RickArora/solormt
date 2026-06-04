from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers


def validate_strong_password(password: str, user=None) -> None:
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(list(exc.messages)) from exc


def verify_recaptcha(token: str, remote_ip: str = "") -> None:
    if not settings.RECAPTCHA_REQUIRED and not settings.RECAPTCHA_SECRET_KEY:
        return

    if not token:
        raise serializers.ValidationError("reCAPTCHA verification is required.")

    if not settings.RECAPTCHA_SECRET_KEY:
        raise serializers.ValidationError("reCAPTCHA is not configured on the server.")

    payload = {
        "secret": settings.RECAPTCHA_SECRET_KEY,
        "response": token,
    }
    if remote_ip:
        payload["remoteip"] = remote_ip

    request = Request(
        "https://www.google.com/recaptcha/api/siteverify",
        data=urlencode(payload).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=5) as response:
            result = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise serializers.ValidationError("Could not verify reCAPTCHA. Please try again.") from exc

    if not result.get("success"):
        raise serializers.ValidationError("reCAPTCHA verification failed.")

    score = result.get("score")
    if score is not None and float(score) < settings.RECAPTCHA_MIN_SCORE:
        raise serializers.ValidationError("reCAPTCHA score was too low.")
