# Deploying SoloRMT (Render)

This repo ships a Render **Blueprint** (`render.yaml`) that stands up the whole
stack — Postgres + Django API + Next.js frontend — from your GitHub repo, with
the services wired together automatically.

## One-time deploy

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. Create a free account at https://render.com and connect your GitHub.
3. Click **New → Blueprint**, pick this repo. Render reads `render.yaml` and shows
   three resources: `solormt-db`, `solormt-api`, `solormt-web`.
4. Click **Apply**. First build takes ~3–5 minutes.

That's it. Render assigns public URLs like:
- Frontend (what you share): `https://solormt-web.onrender.com`
- API: `https://solormt-api.onrender.com`

The frontend's proxy is auto-pointed at the API, so you only ever share the
**frontend** URL.

## Try it

- App / therapist login: `https://solormt-web.onrender.com/app`
- Demo admin (created automatically by `bootstrap_dev`):
  - email: `admin@solormt.local`
  - password: `Admin12345!`
- Django admin: `https://solormt-api.onrender.com/admin/`
- A client booking page exists once a clinic is created, at
  `https://solormt-web.onrender.com/book/<clinic-slug>`

## What the blueprint sets for you

- `DJANGO_SECRET_KEY` — generated
- `DATABASE_URL` — wired from the Postgres instance
- `DJANGO_DEBUG=False` → HTTPS, HSTS, secure cookies all switch on
- `RENDER_EXTERNAL_HOSTNAME` → added to `ALLOWED_HOSTS` automatically
- `DJANGO_API_HOST` (frontend) → the proxy builds `https://<api-host>/api`
- `RECAPTCHA_REQUIRED=False` → so registration/booking work without reCAPTCHA keys

## Notes for a test deployment

- **Free tier sleeps.** After ~15 min idle, services spin down; the first request
  then takes ~30–50s to wake. Fine for testing, not for production.
- **Email** uses the console backend until you set `EMAIL_HOST_PASSWORD` (see
  `docs/EMAIL_SETUP.md`). Intake/reminder emails won't actually send — they print
  to the API service logs. Set `FRONTEND_BASE_URL` to the frontend URL if you wire
  real email so the links are correct.
- **SMS** stays in console-fallback until Twilio is configured (`docs/SMS_SETUP.md`).
- **reCAPTCHA** is off for testing. Turn it on for production: set
  `RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY` and `RECAPTCHA_REQUIRED=True`, and
  set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` on the frontend.

## Going to production later

- Move off the free plan (no sleeping, real CPU/RAM, daily DB backups).
- Set real reCAPTCHA + email (SPF/DKIM/DMARC) + Twilio (A2P registration).
- Review `HIPAA/PHIPA`: sign BAAs with Render + email/SMS providers, confirm DB
  encryption at rest. See the security notes in the README/commit history.
