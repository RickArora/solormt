# SoloRMT

Built for independent massage therapists.

SoloRMT is a clinic management SaaS starter for Ontario and Canadian RMTs. This repository contains a Next.js frontend and Django REST backend scaffold for the MVP:

- Authentication
- Clients CRUD
- Appointments CRUD
- SOAP notes CRUD
- Stripe Checkout payments
- Dashboard metrics

## Project Structure

```text
frontend/   Next.js 15, TypeScript, TailwindCSS
backend/    Django 5, Django REST Framework, PostgreSQL-ready API
docs/       Product and API notes
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

For GitHub Pages:

```bash
cd frontend
npm run build:pages
```

## Backend

Requires Python 3.12 for the Django 5 backend.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API will run at http://localhost:8000.

## Environment

Copy `.env.example` files in each app before running production integrations.
