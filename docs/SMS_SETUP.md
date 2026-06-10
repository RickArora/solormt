# SMS Reminders (Twilio) Setup

SoloRMT sends SMS appointment reminders through Twilio. SMS only goes out when
**both** of these are true:

1. The clinic has **SMS enabled** (Settings → "Enable SMS reminders").
2. The client has **opted in** (`sms_opt_in`) — captured at booking via the
   "Text me reminders" checkbox, and revocable by replying STOP.

With no Twilio credentials, SMS falls back to a console print so dev/tests never
fail silently.

## 1. Configure Twilio

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+15555550123      # a Twilio number you own
```

`pip install -r requirements.txt` already includes `twilio`.

Point your Twilio number's **"A MESSAGE COMES IN"** webhook (Messaging → your
number → Messaging Configuration) at:

```
POST https://api.yourclinic.com/api/sms/webhook/
```

This handles STOP/START replies automatically.

---

## 2. ⚠️ TODO — Carrier registration (REQUIRED before texts deliver)

Unregistered application-to-person (A2P) SMS is filtered or blocked by carriers.
This is the SMS equivalent of the email DNS step — without it, reminders silently
fail to deliver even though Twilio accepts them.

### United States — A2P 10DLC
- [ ] Register your **Brand** (business identity) in the Twilio console.
- [ ] Register a **Campaign** (use case: "Appointment Reminders" / low volume).
- [ ] Attach your sending number to the campaign's Messaging Service.
- [ ] Wait for approval (usually 1–3 business days).

### Canada
- [ ] Use a Canadian **long code** or a **verified toll-free number**.
- [ ] Toll-free numbers now require **toll-free verification** (submit use case
      + opt-in details in the Twilio console) before they deliver reliably.

### Both
- [ ] Confirm the number's webhook points at `/api/sms/webhook/`.
- [ ] (Production) Validate the `X-Twilio-Signature` header in `SmsWebhookView`
      so only Twilio can post opt-outs. See:
      https://www.twilio.com/docs/usage/webhooks/webhooks-security

---

## 3. Consent & opt-out (CASL / TCPA — already implemented)

- **Opt-in** is captured at booking ("Text me appointment reminders"). SMS is
  never queued for a client who hasn't opted in.
- **Opt-out** is automatic: replying **STOP** (or CANCEL/UNSUBSCRIBE/QUIT) sets
  `sms_opt_in = False` and records `sms_opt_out_at`. **START** re-subscribes.
- Every reminder body includes "Reply STOP to opt out."
- SMS bodies **never contain health details** — only clinic name + time.

> Keep proof of consent. The opt-in flag + timestamp on the client record is
> your audit trail.

---

## 4. Run the sender

Same cron as email — one command drains both queues:

```cron
*/5 * * * * cd /path/to/backend && .venv/bin/python manage.py send_reminders
```
