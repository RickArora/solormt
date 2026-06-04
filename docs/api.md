# SoloRMT API Reference

Base URL (local dev): `http://localhost:8000/api/`

All protected endpoints require:
```
Authorization: Bearer <access_token>
```

Tokens are obtained from `/auth/token/` and expire after 15 minutes. Refresh with `/auth/token/refresh/`.

---

## Authentication

### POST `/auth/register/`
Create a new clinic owner account. Returns JWT tokens.

**Body**
```json
{
  "email": "rmt@example.com",
  "password": "SecurePassword123!",
  "first_name": "Alex",
  "last_name": "Lee",
  "clinic_name": "Lakeside Massage",
  "recaptcha_token": ""
}
```

**Response** `201`
```json
{
  "user": { "id": 1, "email": "rmt@example.com", "first_name": "Alex", "last_name": "Lee" },
  "access": "<jwt>",
  "refresh": "<jwt>"
}
```

---

### POST `/auth/token/`
Login. Returns JWT tokens.

**Body**
```json
{ "username": "rmt@example.com", "password": "SecurePassword123!" }
```

**Response** `200`
```json
{ "access": "<jwt>", "refresh": "<jwt>" }
```

---

### POST `/auth/token/refresh/`
Exchange a refresh token for a new access token.

**Body**
```json
{ "refresh": "<jwt>" }
```

---

### GET `/auth/me/` 🔒
Returns the authenticated user's profile.

```json
{ "email": "rmt@example.com", "first_name": "Alex", "last_name": "Lee", "role": "clinic_owner" }
```

---

## Clinic

### GET `/clinic/` 🔒
Returns the clinic belonging to the authenticated owner. Includes services, practitioners, and intake templates.

### PATCH `/clinic/` 🔒
Update clinic settings.

**Patchable fields**
| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `public_email` | string | Shown on booking page |
| `public_phone` | string | |
| `address` | string | |
| `booking_policy` | string | Shown to clients before booking |
| `cancellation_window_hours` | integer | Hours notice required to cancel |
| `deposit_required` | boolean | |
| `deposit_amount_cents` | integer | |
| `payment_provider` | `"stripe"` \| `"square"` | |
| `booking_payment_mode` | `"none"` \| `"deposit"` \| `"card_on_file"` \| `"full_payment"` | |
| `card_on_file_required` | boolean | |
| `reminders_enabled` | boolean | |
| `reminder_email` | string | From address for outgoing reminder emails |
| `sms_enabled` | boolean | Enables SMS reminder sending (requires Twilio config) |
| `noshow_protection_enabled` | boolean | Creates a fee payment when appointment marked as no-show |
| `noshow_fee_cents` | integer | Fee charged for no-shows |

---

## Services

### GET `/services/` 🔒
List all active and inactive services for the clinic.

**Response** — array of:
```json
{
  "id": 1,
  "name": "Massage Therapy",
  "description": "",
  "duration_minutes": 60,
  "price_cents": 12000,
  "price": "120.00",
  "is_active": true
}
```

> To create or edit services, use the Django admin at `/admin/` → Core → Services.

---

## Practitioners

### GET `/practitioners/` 🔒
List all practitioners for the clinic, including their services and weekly availability.

### POST `/practitioners/` 🔒
Add a practitioner.

**Body**
```json
{
  "first_name": "Sam",
  "last_name": "Park",
  "display_name": "Sam Park RMT",
  "email": "sam@clinic.com",
  "phone": "416-555-0100",
  "bio": "Specialising in deep tissue and sports massage.",
  "service_ids": [1, 2],
  "is_active": true
}
```

### POST `/practitioners/<id>/availability/` 🔒
Set a weekly availability block for a practitioner.

**Body**
```json
{
  "weekday": 1,
  "start_time": "09:00",
  "end_time": "17:00",
  "is_active": true
}
```

`weekday`: 0 = Monday … 6 = Sunday

---

## Clients

### GET `/clients/` 🔒
List all clients for the clinic.

### POST `/clients/` 🔒
Add a client.

**Body**
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane@example.com",
  "phone": "416-555-0200",
  "date_of_birth": "1990-04-15",
  "emergency_contact": "Bob Smith 416-555-0201",
  "notes": "Prefers light pressure on neck",
  "insurance_company": "Sun Life Financial",
  "insurance_plan_number": "12345",
  "insurance_member_id": "A987654",
  "insurance_group_number": "GRP-001",
  "insurance_relationship": "self"
}
```

**Insurance fields** (all optional, used for TELUS eClaims)

| Field | Description |
|---|---|
| `insurance_company` | Insurer name (e.g. "Sun Life Financial") |
| `insurance_plan_number` | Policy/plan number |
| `insurance_member_id` | Member certificate / ID number |
| `insurance_group_number` | Group or contract number |
| `insurance_relationship` | `"self"` \| `"spouse"` \| `"dependent"` |

---

## Appointments

### GET `/appointments/` 🔒
List all appointments for the clinic.

### POST `/appointments/` 🔒
Book an appointment manually from the admin.

**Body**
```json
{
  "client": 1,
  "practitioner": 2,
  "service": "Massage Therapy",
  "date": "2026-07-10",
  "time": "10:00",
  "duration_minutes": 60,
  "status": "confirmed",
  "notes": ""
}
```

**Appointment statuses**: `pending` · `confirmed` · `completed` · `cancelled` · `no_show`

### POST `/appointments/<id>/no-show/` 🔒
Mark an appointment as no-show. If `noshow_protection_enabled` is true on the clinic, creates an unpaid payment record for the no-show fee.

**Response**
```json
{
  "appointment": { ...appointment object... },
  "no_show_fee_created": true,
  "fee_cents": 5000
}
```

---

## SOAP Notes

### GET `/soap-notes/` 🔒
List all SOAP notes for the clinic.

### POST `/soap-notes/` 🔒
Create a SOAP note.

**Body**
```json
{
  "client": 1,
  "appointment": 3,
  "subjective": "Client reports tension in upper trapezius.",
  "objective": "Restricted cervical ROM, palpable trigger points at C4-C5.",
  "assessment": "Acute muscle tension, stress-related.",
  "plan": "Weekly sessions for 4 weeks. Home stretching program provided.",
  "is_complete": false
}
```

---

## Payments

### GET `/payments/` 🔒
List all payment records for the clinic.

### POST `/payments/` 🔒
Record a payment manually.

**Body**
```json
{
  "client": 1,
  "amount_cents": 12000,
  "currency": "CAD",
  "status": "paid"
}
```

**Payment statuses**: `paid` · `unpaid` · `failed` · `refunded`

### POST `/payments/checkout/` 🔒
Create a Stripe Checkout session for a client.

**Body**
```json
{
  "client": 1,
  "amount_cents": 12000,
  "description": "Massage therapy appointment"
}
```

### POST `/payments/webhook/`
Stripe webhook endpoint. Configure in your Stripe dashboard to point here. Set `STRIPE_WEBHOOK_SECRET` in your `.env`.

---

## Dashboard

### GET `/dashboard/metrics/` 🔒
Returns live clinic metrics.

```json
{
  "total_clients": 24,
  "upcoming_appointments": 6,
  "appointments_by_status": {
    "confirmed": 4,
    "pending": 2
  },
  "monthly_revenue_cents": 144000,
  "outstanding_invoices_cents": 24000,
  "soap_notes_completed": 18,
  "soap_completion_rate": 75.0
}
```

`upcoming_appointments` excludes cancelled and no-show appointments.

---

## Waitlist

### GET `/waitlist/` 🔒
List all waitlist entries for the clinic.

**Response** — array of:
```json
{
  "id": 1,
  "client": 1,
  "client_name": "Jane Smith",
  "service": 1,
  "service_name": "Massage Therapy",
  "practitioner": null,
  "practitioner_name": "",
  "preferred_date": "2026-07-01",
  "notes": "Flexible on time",
  "status": "waiting",
  "notified_at": null,
  "created_at": "2026-06-04T12:00:00Z"
}
```

**Statuses**: `waiting` · `notified` · `booked` · `expired`

### POST `/waitlist/` 🔒
Add a client to the waitlist.

**Body**
```json
{
  "client": 1,
  "service": 1,
  "practitioner": null,
  "preferred_date": "2026-07-01",
  "notes": ""
}
```

When an appointment is cancelled, waitlisted clients for the matching service are automatically emailed and their status updated to `notified`.

### PATCH `/waitlist/<id>/` 🔒
Update a waitlist entry (e.g. change status to `booked`).

### DELETE `/waitlist/<id>/` 🔒
Remove a waitlist entry.

---

## Packages & Memberships

### GET `/packages/` 🔒
List all package templates for the clinic.

**Response** — array of:
```json
{
  "id": 1,
  "name": "5-Session Bundle",
  "description": "Pre-paid massage package.",
  "service": 1,
  "service_name": "Massage Therapy",
  "sessions": 5,
  "validity_days": 180,
  "price_cents": 55000,
  "price": "550.00",
  "is_active": true
}
```

### POST `/packages/` 🔒
Create a package template.

**Body**
```json
{
  "name": "5-Session Bundle",
  "sessions": 5,
  "validity_days": 180,
  "price_cents": 55000,
  "service": 1,
  "is_active": true
}
```

---

### GET `/client-packages/` 🔒
List all purchased package instances across all clients.

**Response** — array of:
```json
{
  "id": 1,
  "client": 1,
  "client_name": "Jane Smith",
  "package": 1,
  "package_name": "5-Session Bundle",
  "sessions_total": 5,
  "sessions_used": 1,
  "sessions_remaining": 4,
  "price_cents": 55000,
  "status": "active",
  "purchased_at": "2026-06-04T12:00:00Z",
  "expires_at": "2026-12-01"
}
```

**Statuses**: `active` · `exhausted` · `expired` · `cancelled`

### POST `/client-packages/` 🔒
Sell a package to a client. Creates a payment record automatically.

**Body**
```json
{
  "package_id": 1,
  "client_id": 1
}
```

### POST `/client-packages/<id>/redeem/` 🔒
Redeem one session from a client's package. Increments `sessions_used`. Sets status to `exhausted` when the last session is used.

---

## Insurance Claims (TELUS eClaims)

### GET `/insurance-claims/` 🔒
List all insurance claims for the clinic.

**Response** — array of:
```json
{
  "id": 1,
  "client": 1,
  "client_name": "Jane Smith",
  "appointment": 3,
  "payment": null,
  "provider": "telus",
  "claim_number": "TC-F15B2025",
  "service_date": "2026-06-04",
  "diagnosis_code": "",
  "service_code": "21000",
  "amount_submitted_cents": 12000,
  "amount_submitted": "120.00",
  "amount_approved_cents": 0,
  "amount_approved": "0.00",
  "status": "submitted",
  "response_message": "Claim submitted to TELUS eClaims...",
  "submitted_at": "2026-06-04T15:41:10Z",
  "responded_at": null,
  "created_at": "2026-06-04T15:34:25Z"
}
```

**Statuses**: `draft` · `submitted` · `accepted` · `rejected` · `paid`

### POST `/insurance-claims/` 🔒
Create a draft claim.

**Body**
```json
{
  "client": 1,
  "appointment": 3,
  "provider": "telus",
  "service_date": "2026-06-04",
  "service_code": "21000",
  "diagnosis_code": "",
  "amount_submitted_cents": 12000
}
```

**Common RMT service codes**

| Code | Description |
|---|---|
| `21000` | Massage therapy — standard treatment |
| `21001` | Massage therapy — initial assessment |
| `21002` | Massage therapy — follow-up treatment |

### POST `/insurance-claims/<id>/submit/` 🔒
Submit a draft claim to the insurer. For TELUS eClaims, calls the TELUS API (mock in dev) and returns a claim number. For manual claims, marks the claim as submitted for paper follow-up.

**Response** — updated claim object with `claim_number`, `status: "submitted"`, and `submitted_at`.

> **Connecting real TELUS eClaims**: Register at https://provider.telus.com/eclaims to receive `TELUS_ECLAIMS_CLIENT_ID` and `TELUS_ECLAIMS_CLIENT_SECRET`. Set these in `backend/.env` and replace `_submit_to_telus()` in `core/views.py` with the real OAuth2 + REST call.

---

## Public Booking (unauthenticated)

### GET `/public/clinics/<slug>/`
Returns public clinic info: name, address, services, practitioners, booking policy.

### GET `/public/clinics/<slug>/availability/`
Returns open booking slots based on practitioner availability minus existing bookings.

**Query params** (optional)
- `service_id` — filter slots by service
- `practitioner_id` — filter slots by practitioner

**Response**
```json
{
  "clinic": { ...clinic object... },
  "practitioners": [ ...practitioner objects... ],
  "available_slots": [
    { "date": "2026-06-10", "time": "09:00", "practitioner_id": 1, "practitioner_name": "Alex Lee RMT" }
  ],
  "available_days": ["2026-06-10", "2026-06-17"],
  "available_times": ["09:00", "09:30", "10:00"],
  "booked": [ ...existing non-cancelled bookings... ]
}
```

### POST `/public/clinics/<slug>/book/`
Submit a booking. Handles new client registration or existing client login in one call.

**Body**
```json
{
  "auth_mode": "register",
  "service_id": 1,
  "practitioner_id": 1,
  "date": "2026-06-10",
  "time": "10:00",
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane@example.com",
  "password": "SecurePassword123!",
  "phone": "416-555-0200",
  "health_history": "No known conditions.",
  "consent_accepted": true,
  "pay_deposit": false,
  "save_card": false,
  "recaptcha_token": ""
}
```

**Response** `201`
```json
{
  "appointment_id": 5,
  "client_id": 3,
  "intake_id": 2,
  "payment_id": null,
  "payment_required": false,
  "checkout_url": "",
  "client_access": "<jwt>",
  "client_refresh": "<jwt>",
  "status": "pending",
  "message": "Appointment request received."
}
```

Returns `409` if the slot is no longer available.

### POST `/public/clinics/<slug>/portal/auth/`
Client portal login or registration (separate from the admin account system).

**Body**
```json
{
  "mode": "login",
  "email": "jane@example.com",
  "password": "SecurePassword123!",
  "first_name": "",
  "last_name": "",
  "phone": ""
}
```

**Response**
```json
{
  "access": "<jwt>",
  "refresh": "<jwt>",
  "client_id": 3,
  "clinic": { ...clinic object... }
}
```

---

## Client Portal (client JWT)

Authenticated with the client's JWT from the booking or portal auth response.

### GET `/client/clinics/<slug>/portal/`
Returns the client's appointments, intake forms, and payment records for this clinic.

```json
{
  "clinic": { ...clinic object... },
  "client": { "id": 3, "name": "Jane Smith", "email": "jane@example.com", "phone": "..." },
  "appointments": [ ...appointment objects... ],
  "intake_responses": [ ...intake objects... ],
  "payments": [ ...payment objects... ]
}
```

### POST `/client/clinics/<slug>/appointments/<id>/cancel/`
Client cancels their own appointment. Enforces the clinic's `cancellation_window_hours`. Notifies waitlisted clients automatically.

### POST `/client/clinics/<slug>/appointments/<id>/reschedule/`
Client reschedules their appointment.

**Body**
```json
{ "date": "2026-06-17", "time": "11:00" }
```

---

## Intake Responses

### GET `/intake-responses/` 🔒
List all intake form responses for the clinic, linked to clients and appointments.

---

## Reminder Command

Reminders are queued automatically when an appointment is booked or rescheduled. To actually send them, run:

```bash
python manage.py send_reminders
```

Set up a cron job or task runner to call this every few minutes in production:

```cron
*/5 * * * * cd /path/to/backend && .venv/bin/python manage.py send_reminders
```

Requires `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, and `EMAIL_HOST_PASSWORD` in your Django settings or `.env`.

For SMS, wire up Twilio in `core/management/commands/send_reminders.py` → `_send_sms()`.

---

## Error responses

All errors return JSON:

```json
{ "detail": "Human-readable message." }
```

Common HTTP status codes:

| Code | Meaning |
|---|---|
| `400` | Validation error or bad input |
| `401` | Missing or invalid token |
| `403` | Authenticated but not authorised |
| `404` | Resource not found |
| `409` | Conflict (e.g. slot already booked) |
| `422` | Serializer validation failed |

---

## Frontend proxy

In development the Next.js app proxies API requests through `/api/proxy/...` to avoid CORS issues. This is handled by `frontend/app/api/proxy/[...path]/route.ts`.

In production, set `NEXT_PUBLIC_API_URL` to your deployed Django URL and configure CORS via `CORS_ALLOWED_ORIGINS` in `backend/.env`.
