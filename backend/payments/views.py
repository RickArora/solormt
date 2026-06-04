import stripe
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from .models import Payment
from .serializers import CheckoutSerializer, PaymentSerializer


class PaymentViewSet(ModelViewSet):
    serializer_class = PaymentSerializer

    def get_queryset(self):
        return Payment.objects.select_related("client").filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class StripeCheckoutView(APIView):
    def post(self, request):
        serializer = CheckoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        stripe.api_key = settings.STRIPE_SECRET_KEY

        payment = Payment.objects.create(
            owner=request.user,
            client=serializer.validated_data["client"],
            amount_cents=serializer.validated_data["amount_cents"],
            status=Payment.Status.UNPAID,
        )

        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "cad",
                        "product_data": {"name": serializer.validated_data["description"]},
                        "unit_amount": payment.amount_cents,
                    },
                    "quantity": 1,
                }
            ],
            success_url=settings.FRONTEND_SUCCESS_URL,
            cancel_url=settings.FRONTEND_CANCEL_URL,
            metadata={"payment_id": str(payment.id), "client_id": str(payment.client_id)},
        )
        payment.stripe_checkout_session_id = session.id
        payment.save(update_fields=["stripe_checkout_session_id", "updated_at"])
        return Response({"checkout_url": session.url, "payment": PaymentSerializer(payment).data})


@method_decorator(csrf_exempt, name="dispatch")
class StripeWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.body
        signature = request.META.get("HTTP_STRIPE_SIGNATURE")
        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:
            event = stripe.Webhook.construct_event(payload, signature, settings.STRIPE_WEBHOOK_SECRET)
        except (ValueError, stripe.error.SignatureVerificationError):
            return HttpResponse(status=status.HTTP_400_BAD_REQUEST)

        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            payment_id = session.get("metadata", {}).get("payment_id")
            if payment_id:
                Payment.objects.filter(id=payment_id).update(
                    status=Payment.Status.PAID,
                    stripe_payment_id=session.get("payment_intent", ""),
                )

        return HttpResponse(status=status.HTTP_200_OK)

