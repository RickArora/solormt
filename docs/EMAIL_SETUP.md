# Email Setup & Deliverability

SoloRMT sends transactional email (appointment reminders, intake-form requests,
receipts) through Django's email backend. In development with no credentials,
mail is printed to the console. In production, configure an SMTP provider below.

## 1. Pick a provider

Recommended: **Resend** (simplest) or **Postmark** (best healthcare-grade deliverability).

Set these in `backend/.env`:

```env
EMAIL_HOST=smtp.resend.com          # or smtp.postmarkapp.com
EMAIL_PORT=587
EMAIL_HOST_USER=resend              # Postmark: your Server API token
EMAIL_HOST_PASSWORD=<your-api-key>  # this is what flips on real sending
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=YourClinic <noreply@mail.yourclinic.com>
FRONTEND_BASE_URL=https://app.yourclinic.com
```

Once `EMAIL_HOST_PASSWORD` is set, Django switches from the console backend to
real SMTP automatically (see `settings.py`).

---

## 2. ⚠️ TODO — Finish the 3 DNS records (REQUIRED before going live)

**Gmail and Yahoo will send our mail to spam (or reject it) without all three.**
Add these on the DNS for your sending domain (use a subdomain like
`mail.yourclinic.com`, never a bare `@gmail.com` address). Your provider's
dashboard generates the exact values — copy them into your DNS host.

- [ ] **SPF** — TXT record authorizing the provider's servers to send for your domain.
      Example: `v=spf1 include:_spf.resend.com ~all`
- [ ] **DKIM** — CNAME/TXT records the provider gives you (cryptographic signature).
      Resend/Postmark show 1–3 records to paste in.
- [ ] **DMARC** — TXT record at `_dmarc.yourclinic.com` telling Gmail what to do
      with unauthenticated mail and where to send reports.
      Start with: `v=DMARC1; p=none; rua=mailto:dmarc@yourclinic.com`
      then tighten to `p=quarantine` → `p=reject` once reports look clean.

### Verify before launch
- [ ] Provider dashboard shows the domain as **Verified / all records green**.
- [ ] Send a test to a Gmail account → open "Show original" → confirm
      **SPF: PASS, DKIM: PASS, DMARC: PASS**.
- [ ] (Optional) Check with https://www.mail-tester.com for a 10/10 score.

> Until this checklist is complete, keep `EMAIL_HOST_PASSWORD` unset in production
> or expect reminders/intake emails to land in spam.

---

## 3. Run the reminder/intake sender

Reminders and intake-form chases are queued in the database. A cron job drains
the queue:

```cron
*/5 * * * * cd /path/to/backend && .venv/bin/python manage.py send_reminders
```

`send_reminders` sends:
- Appointment confirmations / 48h / same-day reminders
- Intake-form requests and 24h "form still incomplete" chases (deduped)

For SMS, wire Twilio into `core/management/commands/send_reminders.py` → `_send_sms()`.
