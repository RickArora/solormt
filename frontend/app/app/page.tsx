"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  api,
  Appointment,
  Client,
  Clinic,
  IntakeResponse,
  Metrics,
  Payment,
  Service,
  SoapNote
} from "@/lib/api";
import {
  CalendarPlus,
  ClipboardList,
  CreditCard,
  FileText,
  LogOut,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Stethoscope,
  UserPlus
} from "lucide-react";

type Tab = "overview" | "clients" | "appointments" | "soap" | "payments";
type AdminTab = Tab | "intake" | "settings";

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
  const [tab, setTab] = useState<AdminTab>("overview");
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [intakeResponses, setIntakeResponses] = useState<IntakeResponse[]>([]);
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
      const [nextClinic, nextServices, nextIntakeResponses, nextMetrics, nextClients, nextAppointments, nextNotes, nextPayments] = await Promise.all([
        api.clinic(activeToken),
        api.services(activeToken),
        api.intakeResponses(activeToken),
        api.metrics(activeToken),
        api.clients(activeToken),
        api.appointments(activeToken),
        api.soapNotes(activeToken),
        api.payments(activeToken)
      ]);
      setClinic(nextClinic);
      setServices(nextServices);
      setIntakeResponses(nextIntakeResponses);
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

  async function submitClinicSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      const updated = await api.updateClinic(token, {
        name: String(form.get("name")),
        public_email: String(form.get("public_email")),
        public_phone: String(form.get("public_phone")),
        address: String(form.get("address")),
        booking_policy: String(form.get("booking_policy")),
        cancellation_window_hours: Number(form.get("cancellation_window_hours")),
        deposit_required: form.get("deposit_required") === "on",
        deposit_amount_cents: Math.round(Number(form.get("deposit_amount")) * 100),
        reminders_enabled: form.get("reminders_enabled") === "on",
      });
      setClinic(updated);
      setMessage("Clinic settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
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
      { id: "payments" as Tab, label: "Payments", icon: CreditCard },
      { id: "intake" as AdminTab, label: "Intake", icon: FileText },
      { id: "settings" as AdminTab, label: "Settings", icon: ShieldCheck }
    ],
    []
  );

  if (!token) {
    return (
      <main className="min-h-screen bg-[#f7fbff] px-4 py-6 sm:py-10">
        <div className="mx-auto max-w-6xl">
          <Link href="/" className="inline-flex items-center gap-3 font-semibold text-ink">
            <span className="grid size-9 place-items-center rounded-md bg-skybrand text-white">S</span>
            SoloRMT
          </Link>
          <div className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
              <p className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-skybrand">
                <ShieldCheck size={17} />
                Real clinic workspace
              </p>
              <h1 className="mt-5 max-w-xl text-3xl font-semibold leading-tight text-ink sm:text-4xl">
                Manage clients, appointments, SOAP notes, and payments from one clean dashboard.
              </h1>
              <p className="mt-4 max-w-xl leading-7 text-slate-600">
                Register a clinic account, add your clients, book their sessions, complete treatment notes, and see live metrics from the database.
              </p>
              <div className="mt-6 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                {["JWT login", "Django database", "Admin view", "Mobile-ready forms"].map((item) => (
                  <span key={item} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    {item}
                  </span>
                ))}
              </div>
            </section>
            <div className="grid gap-6">
            <AuthCard title="Login" button="Login" onSubmit={(event) => authenticate(event, "login")} />
            <AuthCard title="Create Account" button="Create Account" register onSubmit={(event) => authenticate(event, "register")} />
            </div>
          </div>
          {message ? <p className="mt-4 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">{message}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7fbff]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3 font-semibold text-ink">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-skybrand text-white">S</span>
            <span className="truncate">SoloRMT</span>
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
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${
                  tab === item.id ? "border-skybrand bg-blue-50 text-skybrand shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-skybrand hover:text-skybrand"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-skybrand">Clinic Workspace</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">Practice Dashboard</h1>
          </div>
          {loading ? <p className="text-sm text-slate-500">Syncing database records...</p> : null}
        </div>

        {message ? <p className="mb-4 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">{message}</p> : null}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
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
            list={<ScheduleBoard appointments={appointments} />}
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

        {tab === "intake" ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
            <Panel title="Client Intake Flow">
              <div className="grid gap-3 text-sm text-slate-600">
                <p className="rounded-md border border-slate-200 bg-slate-50 p-3">Clients complete intake and consent during online booking.</p>
                <p className="rounded-md border border-slate-200 bg-slate-50 p-3">Responses are linked to the client and appointment for staff review.</p>
                <p className="rounded-md border border-slate-200 bg-slate-50 p-3">SOAP notes stay internal and are not visible in the client portal.</p>
              </div>
            </Panel>
            <Panel title="Intake Responses">
              <RecordList
                empty="No intake responses yet."
                rows={intakeResponses.map((response) => ({
                  title: response.client_name,
                  meta: `${response.health_history || "No health history provided"} - consent ${response.consent_accepted ? "accepted" : "missing"}`,
                  tag: response.consent_accepted ? "consented" : "needs review",
                }))}
              />
            </Panel>
          </div>
        ) : null}

        {tab === "settings" && clinic ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <Panel title="Booking Links">
              <div className="grid gap-3 text-sm">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-ink">Admin path</p>
                  <p className="mt-1 break-all text-slate-600">{clinic.app_url}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-ink">Client booking path</p>
                  <p className="mt-1 break-all text-slate-600">{clinic.booking_url}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-blue-50 p-3 text-slate-700">
                  Subdomains can come later: {clinic.slug}.solormt.com can resolve to the same clinic slug.
                </div>
              </div>
            </Panel>
            <Panel title="Clinic Settings">
              <ClinicSettingsForm clinic={clinic} onSubmit={submitClinicSettings} />
            </Panel>
            <Panel title="Services">
              <RecordList
                empty="No services configured."
                rows={services.map((service) => ({
                  title: service.name,
                  meta: `${service.duration_minutes} minutes - ${dollars(service.price_cents)}${service.description ? ` - ${service.description}` : ""}`,
                  tag: service.is_active ? "active" : "hidden",
                }))}
              />
            </Panel>
          </div>
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
      <h2 className="text-xl font-semibold text-ink">{props.title}</h2>
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
      <button className="primary-button mt-5 w-full">
        {props.button}
      </button>
    </form>
  );
}

function Metric(props: { label: string; value: string | number; positive?: boolean }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <p className="text-xs leading-4 text-slate-500 sm:text-sm">{props.label}</p>
      <p className={`mt-2 text-xl font-semibold sm:text-2xl ${props.positive ? "text-emerald-700" : "text-ink"}`}>{props.value}</p>
    </article>
  );
}

function Panel(props: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <h2 className="text-lg font-semibold text-ink">{props.title}</h2>
      </div>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function CrudLayout(props: { title: string; form: ReactNode; list: ReactNode }) {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
      <Panel title={`Add ${props.title}`}>{props.form}</Panel>
      <Panel title={props.title}>{props.list}</Panel>
    </div>
  );
}

function RecordList(props: { empty: string; rows: Array<{ title: string; meta: string; tag?: string }> }) {
  if (!props.rows.length) {
    return <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">{props.empty}</p>;
  }
  return (
    <div className="grid gap-3">
      {props.rows.map((row, index) => (
        <div key={`${row.title}-${index}`} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white p-3">
          <div className="min-w-0">
            <p className="font-semibold text-ink">{row.title}</p>
            <p className="mt-1 break-words text-sm text-slate-500">{row.meta}</p>
          </div>
          {row.tag ? <span className="shrink-0 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-skybrand">{row.tag}</span> : null}
        </div>
      ))}
    </div>
  );
}

function ScheduleBoard({ appointments }: { appointments: Appointment[] }) {
  const hours = ["8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM"];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const scheduled = appointments.slice(0, 8);

  if (!appointments.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        No appointments yet. Book a session to see it on the schedule.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-skybrand">Schedule</p>
          <h3 className="font-semibold text-ink">Clinic Calendar</h3>
        </div>
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-1 text-xs font-semibold text-slate-600">
          <span className="rounded bg-skybrand px-3 py-1.5 text-white">Day</span>
          <span className="px-3 py-1.5">Week</span>
          <span className="px-3 py-1.5">List</span>
        </div>
      </div>

      <div className="hidden min-w-[720px] sm:block">
        <div className="grid grid-cols-[72px_repeat(5,1fr)] border-b border-slate-200 bg-white text-sm">
          <div className="border-r border-slate-200 p-3 text-slate-400">Time</div>
          {days.map((day) => (
            <div key={day} className="border-r border-slate-200 p-3 font-semibold text-ink last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[72px_repeat(5,1fr)] bg-white">
          <div className="border-r border-slate-200">
            {hours.map((hour) => (
              <div key={hour} className="h-20 border-b border-slate-100 px-3 py-2 text-xs text-slate-400">
                {hour}
              </div>
            ))}
          </div>
          {days.map((day, dayIndex) => (
            <div key={day} className="relative border-r border-slate-200 last:border-r-0">
              {hours.map((hour) => (
                <div key={hour} className="h-20 border-b border-slate-100" />
              ))}
              {scheduled
                .filter((_, index) => index % days.length === dayIndex)
                .map((appointment, index) => (
                  <div
                    key={appointment.id}
                    className="absolute left-2 right-2 rounded-md border border-skybrand/30 bg-blue-50 p-2 text-xs shadow-sm"
                    style={{ top: `${48 + index * 126}px` }}
                  >
                    <p className="font-semibold text-ink">{appointment.time.slice(0, 5)} {appointment.client_name}</p>
                    <p className="mt-1 text-slate-600">{appointment.service}</p>
                    <span className="mt-2 inline-block rounded bg-white px-2 py-1 font-semibold text-skybrand">{appointment.status}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 bg-white p-3 sm:hidden">
        {appointments.map((appointment) => (
          <article key={appointment.id} className="rounded-md border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-skybrand">
                  {appointment.date} at {appointment.time.slice(0, 5)}
                </p>
                <h4 className="mt-1 font-semibold text-ink">{appointment.client_name}</h4>
                <p className="text-sm text-slate-600">{appointment.service}</p>
              </div>
              <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-skybrand">{appointment.status}</span>
            </div>
          </article>
        ))}
      </div>
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
        className="form-input"
      />
    </label>
  );
}

function Select(props: { name: string; label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {props.label}
      <select name={props.name} required={props.required} className="form-input">
        {props.children}
      </select>
    </label>
  );
}

function TextArea(props: { name: string; label: string }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {props.label}
      <textarea name={props.name} rows={3} className="form-textarea" />
    </label>
  );
}

function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button className="primary-button w-full sm:w-auto">
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

function ClinicSettingsForm({ clinic, onSubmit }: { clinic: Clinic; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field name="name" label="Clinic Name" required defaultValue={clinic.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="public_email" label="Public Email" type="email" defaultValue={clinic.public_email} />
        <Field name="public_phone" label="Public Phone" defaultValue={clinic.public_phone} />
      </div>
      <Field name="address" label="Address" defaultValue={clinic.address} />
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Booking / Cancellation Policy
        <textarea name="booking_policy" rows={4} defaultValue={clinic.booking_policy} className="form-textarea" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="cancellation_window_hours" label="Cancel Window Hours" type="number" defaultValue={String(clinic.cancellation_window_hours)} />
        <Field name="deposit_amount" label="Deposit Amount CAD" type="number" defaultValue={String(clinic.deposit_amount_cents / 100)} />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input name="deposit_required" type="checkbox" defaultChecked={clinic.deposit_required} className="size-4" />
        Require deposit for online booking
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input name="reminders_enabled" type="checkbox" defaultChecked={clinic.reminders_enabled} className="size-4" />
        Enable appointment reminders
      </label>
      <SubmitButton>Save Settings</SubmitButton>
    </form>
  );
}
