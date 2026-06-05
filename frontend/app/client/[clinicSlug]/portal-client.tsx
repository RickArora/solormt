"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import RecaptchaField from "@/components/RecaptchaField";
import { api, Appointment, Clinic, IntakeResponse, Payment } from "@/lib/api";
import { CalendarClock, FileText, LogOut, ReceiptText, RotateCcw } from "lucide-react";

type PortalData = {
  clinic: Clinic;
  client: { id: number; name: string; email: string; phone: string };
  appointments: Appointment[];
  intake_responses: IntakeResponse[];
  payments: Payment[];
};

function dollars(cents: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

export default function ClientPortal({ clinicSlug }: { clinicSlug: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [data, setData] = useState<PortalData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(window.localStorage.getItem(`solormt_client_access_${clinicSlug}`));
  }, [clinicSlug]);

  async function refresh(activeToken = token) {
    if (!activeToken) return;
    setLoading(true);
    try {
      setData(await api.clientPortal(clinicSlug, activeToken));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load portal.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) void refresh(token);
  }, [token]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      const response = await api.clientPortalAuth(clinicSlug, {
        mode,
        email: String(form.get("email")),
        password: String(form.get("password")),
        first_name: String(form.get("first_name")),
        last_name: String(form.get("last_name")),
        phone: String(form.get("phone")),
        recaptcha_token: String(form.get("recaptcha_token")),
      });
      window.localStorage.setItem(`solormt_client_access_${clinicSlug}`, response.access);
      window.localStorage.setItem(`solormt_client_refresh_${clinicSlug}`, response.refresh);
      setToken(response.access);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    window.localStorage.removeItem(`solormt_client_access_${clinicSlug}`);
    window.localStorage.removeItem(`solormt_client_refresh_${clinicSlug}`);
    setToken(null);
    setData(null);
  }

  async function appointmentAction(appointment: Appointment, action: "cancel" | "reschedule", form?: FormData) {
    if (!token) return;
    setLoading(true);
    try {
      await api.clientAppointmentAction(clinicSlug, appointment.id, action, token, {
        date: form ? String(form.get("date")) : undefined,
        time: form ? String(form.get("time")) : undefined,
      });
      setMessage(action === "cancel" ? "Appointment cancelled." : "Reschedule request saved.");
      await refresh(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update appointment.");
    } finally {
      setLoading(false);
    }
  }

  if (!token || !data) {
    return (
      <main className="min-h-screen bg-[#f7fbff] px-4 py-8">
        <section className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <Link href={`/book/${clinicSlug}`} className="text-sm font-semibold text-skybrand">
            Back to booking
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-ink">Client Portal</h1>
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-sm font-semibold">
            <button type="button" onClick={() => setMode("login")} className={`rounded-md px-3 py-2 ${mode === "login" ? "bg-white text-skybrand shadow-sm" : "text-slate-600"}`}>
              Login
            </button>
            <button type="button" onClick={() => setMode("register")} className={`rounded-md px-3 py-2 ${mode === "register" ? "bg-white text-skybrand shadow-sm" : "text-slate-600"}`}>
              Register
            </button>
          </div>
          <form onSubmit={authenticate} className="mt-5 grid gap-4">
            {mode === "register" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="first_name" label="First Name" required />
                <Field name="last_name" label="Last Name" required />
                <Field name="phone" label="Phone" className="sm:col-span-2" />
              </div>
            ) : null}
            <Field name="email" label="Email" type="email" required />
            <Field name="password" label="Password" type="password" required minLength={8} />
            <RecaptchaField action="client-portal-auth" />
            <p className="text-xs text-slate-500">Use at least 8 characters. Common, numeric-only, or easily guessed passwords are rejected.</p>
            <button className="primary-button">{mode === "login" ? "Login" : "Create Portal Account"}</button>
          </form>
          {message ? <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7fbff]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href={`/book/${clinicSlug}`} className="font-semibold text-ink">SoloRMT</Link>
            <button onClick={logout} className="icon-button" title="Log out"><LogOut size={17} /></button>
          </div>
          <p className="text-sm font-semibold text-skybrand">{data.clinic.name}</p>
          <h1 className="text-3xl font-semibold text-ink">Hi, {data.client.name}</h1>
          {loading ? <p className="text-sm text-slate-500">Syncing portal...</p> : null}
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
        {message ? <p className="lg:col-span-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">{message}</p> : null}
        <Panel title="Appointments" icon={<CalendarClock size={18} />}>
          <div className="grid gap-3">
            {data.appointments.length ? data.appointments.map((appointment) => (
              <article key={appointment.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-skybrand">{appointment.date} at {appointment.time.slice(0, 5)}</p>
                    <h3 className="mt-1 font-semibold text-ink">{appointment.service}</h3>
                    <p className="text-sm text-slate-600">{appointment.practitioner_name || "Practitioner pending"} - {appointment.status}</p>
                  </div>
                  {appointment.status !== "cancelled" && appointment.status !== "completed" ? (
                    <button onClick={() => appointmentAction(appointment, "cancel")} className="secondary-button">Cancel</button>
                  ) : null}
                </div>
                {appointment.status !== "cancelled" && appointment.status !== "completed" ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void appointmentAction(appointment, "reschedule", new FormData(event.currentTarget));
                    }}
                    className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    <input name="date" type="date" required className="form-input" />
                    <input name="time" type="time" required className="form-input" />
                    <button className="secondary-button"><RotateCcw size={16} /> Reschedule</button>
                  </form>
                ) : null}
              </article>
            )) : <Empty text="No appointments yet." />}
          </div>
        </Panel>

        <div className="grid gap-6">
          <Panel title="Forms" icon={<FileText size={18} />}>
            <div className="grid gap-3">
              {data.intake_responses.length ? data.intake_responses.map((intake) => (
                <div key={intake.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <p className="font-semibold text-ink">Health history and consent</p>
                  <p className="mt-1 text-slate-600">Status: {intake.status}</p>
                </div>
              )) : <Empty text="No forms assigned yet." />}
            </div>
          </Panel>

          <Panel title="Receipts" icon={<ReceiptText size={18} />}>
            <div className="grid gap-3">
              {data.payments.length ? data.payments.map((payment) => (
                <div key={payment.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <p className="font-semibold text-ink">{dollars(payment.amount_cents)} CAD</p>
                  <p className="mt-1 text-slate-600">{payment.kind} - {payment.status}</p>
                  {payment.checkout_url ? <a href={payment.checkout_url} className="mt-2 inline-flex font-semibold text-skybrand">Open secure payment</a> : null}
                </div>
              )) : <Empty text="No receipts yet." />}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}

function Field(props: { name: string; label: string; type?: string; required?: boolean; className?: string; minLength?: number }) {
  return (
    <label className={`grid gap-1 text-sm font-medium text-slate-700 ${props.className || ""}`}>
      {props.label}
      <input name={props.name} type={props.type || "text"} required={props.required} minLength={props.minLength} className="form-input" />
    </label>
  );
}

function Panel(props: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <span className="text-skybrand">{props.icon}</span>
        <h2 className="font-semibold text-ink">{props.title}</h2>
      </div>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">{text}</p>;
}
