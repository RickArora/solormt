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

Open the printed local URL, usually http://localhost:3000 or http://localhost:3001.

The working user app is at `/app`. It supports:

- Register/login
- Add clients
- Book appointments
- Write SOAP notes
- Record payments
- View metrics from the database

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
python manage.py bootstrap_dev
python manage.py runserver
```

The API will run at http://localhost:8000.

Django Admin:

- URL: http://localhost:8000/admin/
- Email/username: `admin@solormt.local`
- Password: `Admin12345!`

The default local database is SQLite at `backend/db.sqlite3`. For PostgreSQL, set `DATABASE_URL` in `backend/.env`; the project is already configured through `dj-database-url`.

## Environment

Copy `.env.example` files in each app before running production integrations.
