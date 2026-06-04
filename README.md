# SoloRMT

Clinic management software for independent massage therapists. One dashboard for clients, appointments, SOAP notes, payments, and a public booking page clients can use to book directly with you.

---

## Who this is for

- Solo or home-clinic RMTs in Ontario / Canada
- Practitioners who want a booking page they own, not a third-party marketplace
- Anyone who wants client records, SOAP notes, and payments in one place

---

## What's included

| Feature | Where |
|---|---|
| Clinic registration & JWT login | `/app` |
| Client records | Dashboard → Clients tab |
| Appointment scheduling | Dashboard → Appointments tab |
| SOAP notes | Dashboard → SOAP tab |
| Payment recording + Stripe Checkout | Dashboard → Payments tab |
| Team / practitioner management | Dashboard → Team tab |
| Intake forms (health history + consent) | Dashboard → Intake tab |
| Clinic settings & booking links | Dashboard → Settings tab |
| Public online booking page | `/book/<your-clinic-slug>` |
| Client self-service portal | `/client/<your-clinic-slug>` |
| Live dashboard metrics | Overview tab |

---

## Quick start (local development)

### Requirements

- Python **3.12+**
- Node.js **18+**
- npm

### 1. Clone the repo

```bash
git clone <repo-url>
cd solormt
```

### 2. Start the backend

```bash
cd backend

# Create and activate a virtual environment
python3.12 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Seed demo data (creates admin account + sample services)
python manage.py bootstrap_dev

# Start the API server
python manage.py runserver
```

The API runs at **http://localhost:8000**.

**Django admin** (for database inspection):
- URL: http://localhost:8000/admin/
- Username: `admin@solormt.local`
- Password: `Admin12345!`

### 3. Start the frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The app runs at **http://localhost:3000** (or the next available port).

---

## Clinic owner setup walkthrough

This is the full flow from a fresh install to a working clinic.

### Step 1 — Create your clinic account

1. Go to **http://localhost:3000/app**
2. Fill in the **Create Account** form:
   - First name, last name
   - Clinic name (e.g. "Lakeside Massage Therapy")
   - Email and a strong password (12+ characters)
3. Click **Create Account** — you're logged in immediately.

### Step 2 — Configure your clinic settings

Click the **Settings** tab in the dashboard.

- Set your **public email** and **phone** (shown on the booking page)
- Set your **address** (shown on the booking page)
- Write your **booking / cancellation policy** (shown to clients before they book)
- Set the **cancellation window** in hours (e.g. 24 = clients must cancel 24h in advance)
- Choose your **payment mode**: none, deposit, card on file, or full payment
- Toggle **appointment reminders** on or off

Click **Save Settings**.

Your **booking page URL** and **admin path** are shown in the Booking Links panel on the same page. Share the booking URL with clients.

### Step 3 — Add your services

Services are created automatically when you register (Massage Therapy, Initial Assessment, Follow-up Treatment). To view or adjust them, check the **Services** panel in the Settings tab.

> To add custom services or change prices, use the Django admin at `/admin/` → Core → Services.

### Step 4 — Add a practitioner (yourself or your team)

Click the **Team** tab.

Fill in the **Add Practitioner** form:
- First name, last name, display name (shown to clients)
- Email and phone
- Bio (shown on the booking page)
- Tick the **services** this practitioner offers

Click **Save Practitioner**.

Then set their **weekly availability** in the form below:
- Select the practitioner
- Pick a day of the week
- Set start and end time (e.g. 09:00 → 17:00)
- Click **Save Availability**

Repeat for each day they work. Clients will only see slots that fall within these hours.

### Step 5 — Add your first client manually (optional)

Click the **Clients** tab. Fill in the **Add Client** form with name, email, phone, and any notes. Click **Save Client**.

Clients added here can also be linked to appointments and SOAP notes immediately, without waiting for them to book online.

### Step 6 — Test your booking page

Go to **http://localhost:3000/book/your-clinic-slug** (the slug is shown in Settings).

Walk through the booking as if you were a client (Step-by-step guide below). Confirm the appointment appears in your dashboard under Overview and Appointments.

---

## Client booking walkthrough

This is how a client books an appointment from scratch.

### Step 1 — Open the booking page

The clinic owner shares a link like:
```
https://your-domain.com/book/lakeside-massage
```

### Step 2 — Choose a service

The booking page shows all active services with duration and price. Click the one that applies — for example **Massage Therapy, 60 min, $120.00**.

### Step 3 — Choose a practitioner

Practitioners who offer the selected service appear as cards. Click the one you want to book with. If there's only one practitioner, click them.

### Step 4 — Pick a time slot

Open slots appear grouped by date. Times are filtered against the practitioner's availability and any existing bookings, so only genuinely open times show. Click a time to select it — it highlights in blue and a confirmation bar appears below.

### Step 5 — Fill in your details

**New client** — leave the toggle on "New Client" and fill in:
- First name, last name
- Email address
- Password (12+ characters — this creates your client portal login)
- Phone number (optional)
- Health history / reason for visit

**Returning client** — click "Returning Client" and enter your email and password.

### Step 6 — Consent and payment

- Tick the consent checkbox to confirm your health information is accurate and you agree to treatment policies.
- If the clinic requires a deposit or card on file, a payment checkbox will appear — tick it to proceed.

### Step 7 — Confirm

Click **Confirm Appointment Request**. You'll see a confirmation screen with your appointment reference number. The appointment is created as **pending** and visible to the clinic owner immediately.

If the clinic requires payment, a **Continue To Secure Payment** button appears — this opens a Stripe Checkout page to complete the deposit or card-on-file setup.

### Step 8 — Access the client portal

After booking, click **Open Client Portal** (or go to `/client/your-clinic-slug` directly). Log in with the email and password you used during booking.

The portal shows:
- All your appointments with date, time, practitioner, and status
- Your submitted health history and consent form
- Any receipts or payment records

To **cancel** an appointment, click the Cancel button (visible if the appointment is not already cancelled and is outside the clinic's cancellation window).

To **reschedule**, enter a new date and time in the reschedule form and click Reschedule.

---

## Environment variables

Create a `.env` file in `backend/` for any integrations:

```env
# Django
DJANGO_DEBUG=True
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# Database (defaults to SQLite if not set)
DATABASE_URL=postgres://user:password@localhost:5432/solormt

# Stripe (leave blank to skip payment flows)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# URLs Stripe redirects back to after checkout
FRONTEND_SUCCESS_URL=http://localhost:3000/dashboard?payment=success
FRONTEND_CANCEL_URL=http://localhost:3000/dashboard?payment=cancelled

# reCAPTCHA (auto-disabled in DEBUG mode)
RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
```

Create a `.env.local` file in `frontend/` if you need to override the API URL:

```env
# Points to Django — leave unset to use the built-in Next.js proxy
NEXT_PUBLIC_API_URL=
```

---

## Project structure

```
solormt/
├── backend/                  Django REST API
│   ├── appointments/         Appointment model + views
│   ├── clients/              Client model + views
│   ├── core/                 Clinic, Service, Practitioner, Intake, public booking views
│   ├── dashboard/            Metrics endpoint
│   ├── payments/             Payment model + Stripe integration
│   ├── soap_notes/           SOAP note model + views
│   └── solormt/              Django settings, URLs
│
└── frontend/                 Next.js 15 app
    ├── app/
    │   ├── page.tsx           Marketing landing page
    │   ├── app/page.tsx       Admin dashboard (login + all tabs)
    │   ├── book/[slug]/       Public booking page
    │   └── client/[slug]/     Client self-service portal
    ├── components/            Shared UI components
    └── lib/
        ├── api.ts             Typed API client (all backend calls)
        └── data.ts            Static content (feature list etc.)
```

---

## API overview

All endpoints are under `http://localhost:8000/api/`.

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register/` | Create clinic account |
| POST | `/auth/token/` | Login (returns JWT) |
| GET | `/clinic/` | Your clinic details |
| PATCH | `/clinic/` | Update clinic settings |
| GET/POST | `/clients/` | List or add clients |
| GET/POST | `/appointments/` | List or book appointments |
| GET/POST | `/soap-notes/` | List or create SOAP notes |
| GET/POST | `/payments/` | List or record payments |
| GET/POST | `/practitioners/` | List or add practitioners |
| POST | `/practitioners/<id>/availability/` | Set weekly availability |
| GET | `/dashboard/metrics/` | Live clinic metrics |
| GET | `/public/clinics/<slug>/` | Public clinic info |
| GET | `/public/clinics/<slug>/availability/` | Open booking slots |
| POST | `/public/clinics/<slug>/book/` | Submit a booking |
| POST | `/public/clinics/<slug>/portal/auth/` | Client portal login |
| GET | `/client/clinics/<slug>/portal/` | Client's appointments + records |
| POST | `/client/clinics/<slug>/appointments/<id>/cancel/` | Cancel appointment |
| POST | `/client/clinics/<slug>/appointments/<id>/reschedule/` | Reschedule appointment |

Protected endpoints require `Authorization: Bearer <token>` header.

---

## Common questions

**Can I use this without Stripe?**
Yes. Leave `STRIPE_SECRET_KEY` blank. Set the clinic's payment mode to "none" in Settings. Payments can still be recorded manually in the Payments tab.

**What database does it use by default?**
SQLite (`backend/db.sqlite3`). For production, set `DATABASE_URL` to a PostgreSQL connection string.

**How do clients get appointment reminders?**
Reminder records are queued when a booking is made. Actual sending (email/SMS) requires a background task runner (e.g. Celery) and an email/SMS provider — not included in the MVP.

**Can multiple practitioners use the same clinic?**
Yes. Add them in the Team tab, assign their services and availability. They will appear as options on the public booking page.

**What's the difference between `/app` and `/app/<clinic-slug>`?**
Both load the same admin dashboard. The slug route is reserved for multi-clinic support in a future release.
