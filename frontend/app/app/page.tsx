"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  api,
  Appointment,
  Client,
  Metrics,
  Payment,
  SoapNote
} from "@/lib/api";
import {
  CalendarPlus,
  ClipboardList,
  CreditCard,
  LogOut,
  Plus,
  RefreshCcw,
  Stethoscope,
  UserPlus
} from "lucide-react";

type Tab = "overview" | "clients" | "appointments" | "soap" | "payments";

const emptyMetrics: Metrics = {
  total_clients: 0,
  upcoming_appointments: 0,
  appointments_by_status: {},
  monthly_revenue_cents: 0,
  outstanding_invoices_cents: 0,
  soap_notes_completed: 0,
  soap_completion_rate: 0
};

function dollars(cents: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AppPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [soapNotes, setSoapNotes] = useState<SoapNote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(window.localStorage.getItem("solormt_access"));
  }, []);

  async function refresh(activeToken = token) {
    if (!activeToken) return;
    setLoading(true);
    setMessage("");
    try {
      const [nextMetrics, nextClients, nextAppointments, nextNotes, nextPayments] = await Promise.all([
        api.metrics(activeToken),
        api.clients(activeToken),
        api.appointments(activeToken),
        api.soapNotes(activeToken),
        api.payments(activeToken)
      ]);
      setMetrics(nextMetrics);
      setClients(nextClients);
      setAppointments(nextAppointments);
      setSoapNotes(nextNotes);
      setPayments(nextPayments);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) void refresh(token);
  }, [token]);

  async function authenticate(event: FormEvent<HTMLFormElement>, mode: "login" | "register") {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setMessage("");
    try {
      const response =
        mode === "login"
          ? await api.login(String(form.get("email")), String(form.get("password")))
          : await api.register({
              email: String(form.get("email")),
              password: String(form.get("password")),
              first_name: String(form.get("first_name")),
              last_name: String(form.get("last_name")),
              clinic_name: String(form.get("clinic_name"))
            });
      window.localStorage.setItem("solormt_access", response.access);
      window.localStorage.setItem("solormt_refresh", response.refresh);
      setToken(response.access);
      setMessage("Signed in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    window.localStorage.removeItem("solormt_access");
    window.localStorage.removeItem("solormt_refresh");
    setToken(null);
  }

  async function submitClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoading(true);
    try {
      await api.createClient(token, {
        first_name: String(form.get("first_name")),
        last_name: String(form.get("last_name")),
        email: String(form.get("email")),
        phone: String(form.get("phone")),
        date_of_birth: String(form.get("date_of_birth")) || null,
        emergency_contact: String(form.get("emergency_contact")),
        notes: String(form.get("notes"))
      });
      formElement.reset();
      setMessage("Client saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save client.");
    } finally {
      setLoading(false);
    }
  }

  async function submitAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoading(true);
    try {
      await api.createAppointment(token, {
        client: Number(form.get("client")),
        service: String(form.get("service")),
        date: String(form.get("date")),
        time: String(form.get("time")),
        duration_minutes: Number(form.get("duration_minutes")),
        status: String(form.get("status")) as Appointment["status"],
        notes: String(form.get("notes"))
      });
      formElement.reset();
      setMessage("Appointment booked.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not book appointment.");
    } finally {
      setLoading(false);
    }
  }

  async function submitSoap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoading(true);
    try {
      await api.createSoapNote(token, {
        client: Number(form.get("client")),
        appointment: form.get("appointment") ? Number(form.get("appointment")) : null,
        subjective: String(form.get("subjective")),
        objective: String(form.get("objective")),
        assessment: String(form.get("assessment")),
        plan: String(form.get("plan")),
        is_complete: form.get("is_complete") === "on"
      });
      formElement.reset();
      setMessage("SOAP note saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save SOAP note.");
    } finally {
      setLoading(false);
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoading(true);
    try {
      await api.createPayment(token, {
        client: Number(form.get("client")),
        amount_cents: Math.round(Number(form.get("amount")) * 100),
        currency: "CAD",
        status: String(form.get("status")) as Payment["status"]
      });
      formElement.reset();
      setMessage("Payment recorded.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not record payment.");
    } finally {
      setLoading(false);
    }
  }

  const tabs = useMemo(
    () => [
      { id: "overview" as Tab, label: "Overview", icon: Stethoscope },
      { id: "clients" as Tab, label: "Clients", icon: UserPlus },
      { id: "appointments" as Tab, label: "Appointments", icon: CalendarPlus },
      { id: "soap" as Tab, label: "SOAP", icon: ClipboardList },
      { id: "payments" as Tab, label: "Payments", icon: CreditCard }
    ],
    []
  );

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <Link href="/" className="inline-flex items-center gap-3 font-semibold text-ink">
            <span className="grid size-9 place-items-center rounded-md bg-skybrand text-white">S</span>
            SoloRMT
          </Link>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <AuthCard title="Login" button="Login" onSubmit={(event) => authenticate(event, "login")} />
            <AuthCard title="Create Account" button="Create Account" register onSubmit={(event) => authenticate(event, "register")} />
          </div>
          {message ? <p className="mt-4 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">{message}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold text-ink">
            <span className="grid size-9 place-items-center rounded-md bg-skybrand text-white">S</span>
            SoloRMT
          </Link>
          <div className="flex gap-2">
            <button onClick={() => refresh()} className="icon-button" title="Refresh data">
              <RefreshCcw size={17} />
            </button>
            <button onClick={logout} className="icon-button" title="Log out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-4 sm:px-6 lg:px-8">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                  tab === item.id ? "border-skybrand bg-blue-50 text-skybrand" : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {message ? <p className="mb-4 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">{message}</p> : null}
        {loading ? <p className="mb-4 text-sm text-slate-500">Loading database records...</p> : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Total Clients" value={metrics.total_clients} />
          <Metric label="Upcoming Appointments" value={metrics.upcoming_appointments} />
          <Metric label="Monthly Revenue" value={dollars(metrics.monthly_revenue_cents)} positive />
          <Metric label="Outstanding" value={dollars(metrics.outstanding_invoices_cents)} />
          <Metric label="SOAP Completion" value={`${metrics.soap_completion_rate}%`} />
        </section>

        {tab === "overview" ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Panel title="Upcoming Appointments">
              <RecordList
                empty="No appointments yet."
                rows={appointments.map((item) => ({
                  title: item.client_name,
                  meta: `${item.date} at ${item.time.slice(0, 5)} - ${item.service}`,
                  tag: item.status
                }))}
              />
            </Panel>
            <Panel title="Recent Clients">
              <RecordList
                empty="No clients yet."
                rows={clients.slice(0, 5).map((item) => ({
                  title: `${item.first_name} ${item.last_name}`,
                  meta: `${item.email || "No email"} ${item.phone ? `- ${item.phone}` : ""}`
                }))}
              />
            </Panel>
          </div>
        ) : null}

        {tab === "clients" ? (
          <CrudLayout
            title="Clients"
            form={<ClientForm onSubmit={submitClient} />}
            list={<RecordList empty="No clients yet." rows={clients.map((c) => ({ title: `${c.first_name} ${c.last_name}`, meta: `${c.email || "No email"} ${c.phone || ""}` }))} />}
          />
        ) : null}

        {tab === "appointments" ? (
          <CrudLayout
            title="Appointments"
            form={<AppointmentForm clients={clients} onSubmit={submitAppointment} />}
            list={<RecordList empty="No appointments yet." rows={appointments.map((a) => ({ title: a.client_name, meta: `${a.date} at ${a.time.slice(0, 5)} - ${a.service}`, tag: a.status }))} />}
          />
        ) : null}

        {tab === "soap" ? (
          <CrudLayout
            title="SOAP Notes"
            form={<SoapForm clients={clients} appointments={appointments} onSubmit={submitSoap} />}
            list={<RecordList empty="No SOAP notes yet." rows={soapNotes.map((n) => ({ title: n.client_name, meta: n.assessment || "Draft note", tag: n.is_complete ? "complete" : "draft" }))} />}
          />
        ) : null}

        {tab === "payments" ? (
          <CrudLayout
            title="Payments"
            form={<PaymentForm clients={clients} onSubmit={submitPayment} />}
            list={<RecordList empty="No payments yet." rows={payments.map((p) => ({ title: p.client_name, meta: `${p.amount} ${p.currency}`, tag: p.status }))} />}
          />
        ) : null}
      </div>
    </main>
  );
}

function AuthCard(props: {
  title: string;
  button: string;
  register?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={props.onSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-ink">{props.title}</h1>
      {props.register ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field name="first_name" label="First Name" required />
          <Field name="last_name" label="Last Name" required />
          <Field name="clinic_name" label="Clinic Name" className="sm:col-span-2" />
        </div>
      ) : null}
      <div className="mt-5 grid gap-4">
        <Field name="email" label="Email" type="email" required />
        <Field name="password" label="Password" type="password" required />
      </div>
      <button className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-skybrand px-4 font-semibold text-white">
        {props.button}
      </button>
    </form>
  );
}

function Metric(props: { label: string; value: string | number; positive?: boolean }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{props.label}</p>
      <p className={`mt-2 text-2xl font-semibold ${props.positive ? "text-emerald-700" : "text-ink"}`}>{props.value}</p>
    </article>
  );
}

function Panel(props: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">{props.title}</h2>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function CrudLayout(props: { title: string; form: ReactNode; list: ReactNode }) {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <Panel title={`Add ${props.title}`}>{props.form}</Panel>
      <Panel title={props.title}>{props.list}</Panel>
    </div>
  );
}

function RecordList(props: { empty: string; rows: Array<{ title: string; meta: string; tag?: string }> }) {
  if (!props.rows.length) {
    return <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">{props.empty}</p>;
  }
  return (
    <div className="divide-y divide-slate-100">
      {props.rows.map((row, index) => (
        <div key={`${row.title}-${index}`} className="flex items-start justify-between gap-3 py-3">
          <div>
            <p className="font-semibold text-ink">{row.title}</p>
            <p className="text-sm text-slate-500">{row.meta}</p>
          </div>
          {row.tag ? <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-skybrand">{row.tag}</span> : null}
        </div>
      ))}
    </div>
  );
}

function Field(props: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  className?: string;
  defaultValue?: string;
}) {
  return (
    <label className={`grid gap-1 text-sm font-medium text-slate-700 ${props.className || ""}`}>
      {props.label}
      <input
        name={props.name}
        type={props.type || "text"}
        required={props.required}
        defaultValue={props.defaultValue}
        className="min-h-11 rounded-md border border-slate-300 px-3 outline-none focus:border-skybrand"
      />
    </label>
  );
}

function Select(props: { name: string; label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {props.label}
      <select name={props.name} required={props.required} className="min-h-11 rounded-md border border-slate-300 px-3 outline-none focus:border-skybrand">
        {props.children}
      </select>
    </label>
  );
}

function TextArea(props: { name: string; label: string }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {props.label}
      <textarea name={props.name} rows={3} className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-skybrand" />
    </label>
  );
}

function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-skybrand px-4 font-semibold text-white">
      <Plus size={17} />
      {children}
    </button>
  );
}

function ClientForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="first_name" label="First Name" required />
        <Field name="last_name" label="Last Name" required />
      </div>
      <Field name="email" label="Email" type="email" />
      <Field name="phone" label="Phone" />
      <Field name="date_of_birth" label="Date of Birth" type="date" />
      <Field name="emergency_contact" label="Emergency Contact" />
      <TextArea name="notes" label="Notes" />
      <SubmitButton>Save Client</SubmitButton>
    </form>
  );
}

function AppointmentForm({ clients, onSubmit }: { clients: Client[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Select name="client" label="Client" required>
        <option value="">Select client</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.first_name} {client.last_name}
          </option>
        ))}
      </Select>
      <Field name="service" label="Service" required defaultValue="Massage Therapy" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="date" label="Date" type="date" required defaultValue={today()} />
        <Field name="time" label="Time" type="time" required defaultValue="09:00" />
        <Field name="duration_minutes" label="Minutes" type="number" required defaultValue="60" />
      </div>
      <Select name="status" label="Status">
        <option value="pending">Pending</option>
        <option value="confirmed">Confirmed</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </Select>
      <TextArea name="notes" label="Appointment Notes" />
      <SubmitButton>Book Appointment</SubmitButton>
    </form>
  );
}

function SoapForm({
  clients,
  appointments,
  onSubmit
}: {
  clients: Client[];
  appointments: Appointment[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Select name="client" label="Client" required>
        <option value="">Select client</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.first_name} {client.last_name}
          </option>
        ))}
      </Select>
      <Select name="appointment" label="Appointment">
        <option value="">None</option>
        {appointments.map((appointment) => (
          <option key={appointment.id} value={appointment.id}>
            {appointment.client_name} - {appointment.date}
          </option>
        ))}
      </Select>
      <TextArea name="subjective" label="Subjective" />
      <TextArea name="objective" label="Objective" />
      <TextArea name="assessment" label="Assessment" />
      <TextArea name="plan" label="Plan" />
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" name="is_complete" className="size-4" />
        Mark complete
      </label>
      <SubmitButton>Save SOAP Note</SubmitButton>
    </form>
  );
}

function PaymentForm({ clients, onSubmit }: { clients: Client[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Select name="client" label="Client" required>
        <option value="">Select client</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.first_name} {client.last_name}
          </option>
        ))}
      </Select>
      <Field name="amount" label="Amount CAD" type="number" required defaultValue="120" />
      <Select name="status" label="Status">
        <option value="paid">Paid</option>
        <option value="unpaid">Unpaid</option>
        <option value="failed">Failed</option>
        <option value="refunded">Refunded</option>
      </Select>
      <SubmitButton>Record Payment</SubmitButton>
    </form>
  );
}
