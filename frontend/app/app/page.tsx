"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RecaptchaField from "@/components/RecaptchaField";
import CalendarTab from "@/components/calendar";
import ClientProfilePanel from "@/components/client-profile";
import {
  api,
  ApiError,
  Appointment,
  Client,
  ClientPackage,
  ClientProfile,
  Clinic,
  InsuranceClaim,
  IntakeResponse,
  Metrics,
  Package,
  Payment,
  Practitioner,
  Service,
  SoapNote,
  WaitlistEntry,
} from "@/lib/api";
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  ListOrdered,
  LogOut,
  Package as PackageIcon,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserPlus,
} from "lucide-react";

type Tab = "overview" | "clients" | "appointments" | "soap" | "payments";
type AdminTab = Tab | "team" | "schedule" | "intake" | "waitlist" | "packages" | "claims" | "settings";

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
  const [tab, setTab] = useState<AdminTab>("appointments");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [intakeResponses, setIntakeResponses] = useState<IntakeResponse[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [soapNotes, setSoapNotes] = useState<SoapNote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [clientPackages, setClientPackages] = useState<ClientPackage[]>([]);
  const [insuranceClaims, setInsuranceClaims] = useState<InsuranceClaim[]>([]);

  useEffect(() => {
    setToken(window.localStorage.getItem("solormt_access"));
  }, []);

  async function refresh(activeToken = token) {
    if (!activeToken) return;
    setLoading(true);
    setMessage("");
    try {
      const [
        nextClinic, nextServices, nextPractitioners, nextIntakeResponses, nextMetrics,
        nextClients, nextAppointments, nextNotes, nextPayments,
        nextWaitlist, nextPackages, nextClientPackages, nextClaims,
      ] = await Promise.all([
        api.clinic(activeToken),
        api.services(activeToken),
        api.practitioners(activeToken),
        api.intakeResponses(activeToken),
        api.metrics(activeToken),
        api.clients(activeToken),
        api.appointments(activeToken),
        api.soapNotes(activeToken),
        api.payments(activeToken),
        api.waitlist(activeToken),
        api.packages(activeToken),
        api.clientPackages(activeToken),
        api.insuranceClaims(activeToken),
      ]);
      setClinic(nextClinic);
      setServices(nextServices);
      setPractitioners(nextPractitioners);
      setIntakeResponses(nextIntakeResponses);
      setMetrics(nextMetrics);
      setClients(nextClients);
      setAppointments(nextAppointments);
      setSoapNotes(nextNotes);
      setPayments(nextPayments);
      setWaitlist(nextWaitlist);
      setPackages(nextPackages);
      setClientPackages(nextClientPackages);
      setInsuranceClaims(nextClaims);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        return;
      }
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
              clinic_name: String(form.get("clinic_name")),
              recaptcha_token: String(form.get("recaptcha_token"))
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

  async function submitForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await api.requestPasswordReset(forgotEmail);
      setForgotSent(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleServiceIntake(serviceId: number, requires: boolean) {
    if (!token) return;
    setLoading(true);
    try {
      await api.updateService(token, serviceId, { requires_intake: requires });
      setMessage(requires ? "Intake form will be auto-sent for this service." : "Auto-send intake disabled for this service.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update service.");
    } finally {
      setLoading(false);
    }
  }

  async function openProfile(clientId: number) {
    if (!token) return;
    setProfileOpen(true);
    setProfileLoading(true);
    setProfile(null);
    try {
      setProfile(await api.clientProfile(token, clientId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load client profile.");
      setProfileOpen(false);
    } finally {
      setProfileLoading(false);
    }
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
        practitioner: form.get("practitioner") ? Number(form.get("practitioner")) : null,
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

  async function submitPractitioner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoading(true);
    try {
      await api.createPractitioner(token, {
        first_name: String(form.get("first_name")),
        last_name: String(form.get("last_name")),
        display_name: String(form.get("display_name")),
        email: String(form.get("email")),
        phone: String(form.get("phone")),
        bio: String(form.get("bio")),
        service_ids: form.getAll("service_ids").map((value) => Number(value)),
        is_active: true,
      });
      formElement.reset();
      setMessage("Practitioner saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save practitioner.");
    } finally {
      setLoading(false);
    }
  }

  async function submitAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoading(true);
    try {
      await api.createPractitionerAvailability(token, Number(form.get("practitioner")), {
        weekday: Number(form.get("weekday")),
        start_time: String(form.get("start_time")),
        end_time: String(form.get("end_time")),
        is_active: true,
      });
      formElement.reset();
      setMessage("Availability saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save availability.");
    } finally {
      setLoading(false);
    }
  }

  async function saveScheduleSettings(practitionerId: number, payload: { slot_duration_minutes: number; buffer_minutes: number; slot_duration_options: number[] }) {
    if (!token) return;
    setLoading(true);
    try {
      await api.updatePractitioner(token, practitionerId, payload);
      setMessage("Schedule settings saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save schedule settings.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAvailabilityBlock(practitionerId: number, availabilityId: number) {
    if (!token) return;
    setLoading(true);
    try {
      await api.deletePractitionerAvailability(token, practitionerId, availabilityId);
      setMessage("Availability removed.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove availability.");
    } finally {
      setLoading(false);
    }
  }

  async function submitWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoading(true);
    try {
      await api.createWaitlistEntry(token, {
        client: Number(form.get("client")),
        service: Number(form.get("service")),
        practitioner: form.get("practitioner") ? Number(form.get("practitioner")) : null,
        preferred_date: String(form.get("preferred_date")) || null,
        notes: String(form.get("notes")),
      });
      formElement.reset();
      setMessage("Added to waitlist.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add to waitlist.");
    } finally {
      setLoading(false);
    }
  }

  async function handleNoShow(appointmentId: number) {
    if (!token) return;
    if (!confirm("Mark this appointment as no-show? A fee will be created if no-show protection is enabled.")) return;
    setLoading(true);
    try {
      const result = await api.markNoShow(token, appointmentId);
      setMessage(`Marked as no-show.${result.no_show_fee_created ? ` $${(result.fee_cents / 100).toFixed(2)} fee created.` : ""}`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not mark no-show.");
    } finally {
      setLoading(false);
    }
  }

  async function submitPackage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoading(true);
    try {
      await api.createPackage(token, {
        name: String(form.get("name")),
        description: String(form.get("description")),
        service: form.get("service") ? Number(form.get("service")) : null,
        sessions: Number(form.get("sessions")),
        validity_days: Number(form.get("validity_days")),
        price_cents: Math.round(Number(form.get("price")) * 100),
        is_active: true,
      });
      formElement.reset();
      setMessage("Package created.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create package.");
    } finally {
      setLoading(false);
    }
  }

  async function purchasePackage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoading(true);
    try {
      await api.purchasePackage(token, {
        package_id: Number(form.get("package_id")),
        client_id: Number(form.get("client_id")),
      });
      formElement.reset();
      setMessage("Package purchased for client. Payment record created.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not purchase package.");
    } finally {
      setLoading(false);
    }
  }

  async function redeemSession(clientPackageId: number) {
    if (!token) return;
    setLoading(true);
    try {
      await api.redeemPackageSession(token, clientPackageId);
      setMessage("Session redeemed.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not redeem session.");
    } finally {
      setLoading(false);
    }
  }

  async function submitClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoading(true);
    try {
      await api.createInsuranceClaim(token, {
        client: Number(form.get("client")),
        appointment: form.get("appointment") ? Number(form.get("appointment")) : null,
        provider: String(form.get("provider")) as InsuranceClaim["provider"],
        service_date: String(form.get("service_date")),
        service_code: String(form.get("service_code")) || "21000",
        diagnosis_code: String(form.get("diagnosis_code")),
        amount_submitted_cents: Math.round(Number(form.get("amount_submitted")) * 100),
      });
      formElement.reset();
      setMessage("Claim created as draft. Use Submit to send to insurer.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create claim.");
    } finally {
      setLoading(false);
    }
  }

  async function submitClaimToInsurer(claimId: number) {
    if (!token) return;
    setLoading(true);
    try {
      const claim = await api.submitInsuranceClaim(token, claimId);
      setMessage(`Claim ${claim.claim_number} submitted. Status: ${claim.status}.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit claim.");
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
        payment_provider: String(form.get("payment_provider")) as Clinic["payment_provider"],
        booking_payment_mode: String(form.get("booking_payment_mode")) as Clinic["booking_payment_mode"],
        card_on_file_required: form.get("card_on_file_required") === "on",
        reminders_enabled: form.get("reminders_enabled") === "on",
        reminder_email: String(form.get("reminder_email")),
        sms_enabled: form.get("sms_enabled") === "on",
        noshow_protection_enabled: form.get("noshow_protection_enabled") === "on",
        noshow_fee_cents: Math.round(Number(form.get("noshow_fee")) * 100),
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
      { id: "appointments" as Tab, label: "Calendar", icon: CalendarDays },
      { id: "team" as AdminTab, label: "Team", icon: UserPlus },
      { id: "schedule" as AdminTab, label: "Schedule", icon: Clock },
      { id: "soap" as Tab, label: "SOAP", icon: ClipboardList },
      { id: "payments" as Tab, label: "Payments", icon: CreditCard },
      { id: "waitlist" as AdminTab, label: "Waitlist", icon: ListOrdered },
      { id: "packages" as AdminTab, label: "Packages", icon: PackageIcon },
      { id: "claims" as AdminTab, label: "eClaims", icon: ShieldCheck },
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
              {forgotMode ? (
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-semibold text-ink">Reset Password</h2>
                  {forgotSent ? (
                    <p className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
                      If that email is registered, a reset link has been sent. Check your inbox.
                    </p>
                  ) : (
                    <form onSubmit={submitForgotPassword} className="mt-5 grid gap-4">
                      <Field name="forgot_email" label="Email" type="email" required value={forgotEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForgotEmail(e.target.value)} />
                      <button className="primary-button w-full" disabled={loading}>{loading ? "Sending…" : "Send Reset Link"}</button>
                    </form>
                  )}
                  <button onClick={() => { setForgotMode(false); setForgotSent(false); setMessage(""); }} className="mt-3 text-sm text-skybrand hover:underline">
                    Back to login
                  </button>
                </div>
              ) : (
                <>
                  <AuthCard title="Login" button="Login" onSubmit={(event) => authenticate(event, "login")}>
                    <button type="button" onClick={() => { setForgotMode(true); setMessage(""); }} className="mt-1 text-xs text-skybrand hover:underline text-left">
                      Forgot password?
                    </button>
                  </AuthCard>
                  {message ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{message}</p> : null}
                  <AuthCard title="Create Account" button="Create Account" register onSubmit={(event) => authenticate(event, "register")} />
                </>
              )}
            </div>
          </div>
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
              {appointments.length ? (
                <div className="grid gap-3">
                  {appointments.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white p-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{item.client_name}</p>
                        <p className="mt-1 text-sm text-slate-500">{item.date} at {item.time.slice(0, 5)} — {item.service}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-skybrand">{item.status}</span>
                        {item.status === "confirmed" || item.status === "pending" ? (
                          <button onClick={() => handleNoShow(item.id)} title="Mark no-show" className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100">
                            <AlertTriangle size={12} /> No-show
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No appointments yet.</p>
              )}
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
            list={
              clients.length ? (
                <div className="grid gap-3">
                  {clients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => openProfile(c.id)}
                      className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-skybrand hover:shadow-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{c.first_name} {c.last_name}</p>
                        <p className="mt-1 truncate text-sm text-slate-500">{c.email || "No email"} {c.phone || ""}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-skybrand">View profile →</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No clients yet.</p>
              )
            }
          />
        ) : null}

        {tab === "appointments" ? (
          <CalendarTab
            appointments={appointments}
            clients={clients}
            practitioners={practitioners}
            services={services}
            intakeResponses={intakeResponses}
            setMessage={setMessage}
            onCreate={async (payload) => {
              if (!token) return;
              await api.createAppointment(token, payload);
              await refresh();
            }}
            onUpdate={async (id, payload) => {
              if (!token) return;
              await api.updateAppointment(token, id, payload);
              await refresh();
            }}
            onDelete={async (id) => {
              if (!token) return;
              await api.deleteAppointment(token, id);
              await refresh();
            }}
            onSendReminder={async (id) => {
              if (!token) return { sent: false, to: "" };
              return api.sendAppointmentReminder(token, id);
            }}
          />
        ) : null}

        {tab === "team" ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
            <Panel title="Add Practitioner">
              <PractitionerForm services={services} onSubmit={submitPractitioner} />
            </Panel>
            <div className="grid gap-6">
              <Panel title="Weekly Availability">
                <AvailabilityForm practitioners={practitioners} onSubmit={submitAvailability} />
              </Panel>
              <Panel title="Practitioners">
                <RecordList
                  empty="No practitioners yet."
                  rows={practitioners.map((practitioner) => ({
                    title: practitioner.name,
                    meta: `${practitioner.email || "No email"} - ${practitioner.services.map((service) => service.name).join(", ") || "No services assigned"}`,
                    tag: practitioner.is_active ? "active" : "hidden",
                  }))}
                />
              </Panel>
            </div>
          </div>
        ) : null}

        {tab === "schedule" ? (
          <ScheduleSettings
            practitioners={practitioners}
            onSaveSettings={saveScheduleSettings}
            onAddAvailability={submitAvailability}
            onDeleteAvailability={deleteAvailabilityBlock}
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

        {tab === "waitlist" ? (
          <CrudLayout
            title="Waitlist"
            form={
              <form onSubmit={submitWaitlist} className="grid gap-4">
                <Select name="client" label="Client" required>
                  <option value="">Select client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                  ))}
                </Select>
                <Select name="service" label="Service" required>
                  <option value="">Select service</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
                <Select name="practitioner" label="Practitioner (optional)">
                  <option value="">Any practitioner</option>
                  {practitioners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
                <Field name="preferred_date" label="Preferred date (optional)" type="date" />
                <TextArea name="notes" label="Notes" />
                <SubmitButton>Add to Waitlist</SubmitButton>
              </form>
            }
            list={
              <RecordList
                empty="No one on the waitlist."
                rows={waitlist.map((w) => ({
                  title: w.client_name,
                  meta: `${w.service_name}${w.practitioner_name ? ` – ${w.practitioner_name}` : ""}${w.preferred_date ? ` · ${w.preferred_date}` : ""}`,
                  tag: w.status,
                }))}
              />
            }
          />
        ) : null}

        {tab === "packages" ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="grid gap-6">
              <Panel title="Create Package">
                <form onSubmit={submitPackage} className="grid gap-4">
                  <Field name="name" label="Package Name" required />
                  <TextArea name="description" label="Description" />
                  <Select name="service" label="Service">
                    <option value="">Any service</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field name="sessions" label="Sessions" type="number" required defaultValue="5" />
                    <Field name="validity_days" label="Valid (days)" type="number" required defaultValue="365" />
                    <Field name="price" label="Price CAD" type="number" required defaultValue="500" />
                  </div>
                  <SubmitButton>Create Package</SubmitButton>
                </form>
              </Panel>
              <Panel title="Sell Package to Client">
                <form onSubmit={purchasePackage} className="grid gap-4">
                  <Select name="client_id" label="Client" required>
                    <option value="">Select client</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                  </Select>
                  <Select name="package_id" label="Package" required>
                    <option value="">Select package</option>
                    {packages.filter((p) => p.is_active).map((p) => (
                      <option key={p.id} value={p.id}>{p.name} – ${(p.price_cents / 100).toFixed(2)}</option>
                    ))}
                  </Select>
                  <SubmitButton>Sell Package</SubmitButton>
                </form>
              </Panel>
            </div>
            <div className="grid gap-6">
              <Panel title="Package Templates">
                <RecordList
                  empty="No packages created yet."
                  rows={packages.map((p) => ({
                    title: p.name,
                    meta: `${p.sessions} sessions · ${p.validity_days}d validity · $${(p.price_cents / 100).toFixed(2)}`,
                    tag: p.is_active ? "active" : "hidden",
                  }))}
                />
              </Panel>
              <Panel title="Client Packages">
                {clientPackages.length ? (
                  <div className="grid gap-3">
                    {clientPackages.map((cp) => (
                      <div key={cp.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white p-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">{cp.client_name}</p>
                          <p className="mt-1 text-sm text-slate-500">{cp.package_name} · {cp.sessions_remaining}/{cp.sessions_total} sessions left</p>
                          {cp.expires_at ? <p className="mt-1 text-xs text-slate-400">Expires {cp.expires_at}</p> : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-skybrand">{cp.status}</span>
                          {cp.status === "active" && cp.sessions_remaining > 0 ? (
                            <button onClick={() => redeemSession(cp.id)} className="secondary-button text-xs">Redeem</button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No client packages yet.</p>
                )}
              </Panel>
            </div>
          </div>
        ) : null}

        {tab === "claims" ? (
          <CrudLayout
            title="Insurance Claims"
            form={
              <form onSubmit={submitClaim} className="grid gap-4">
                <Select name="client" label="Client" required>
                  <option value="">Select client</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </Select>
                <Select name="appointment" label="Appointment (optional)">
                  <option value="">None</option>
                  {appointments.filter((a) => a.status === "completed").map((a) => (
                    <option key={a.id} value={a.id}>{a.client_name} – {a.date}</option>
                  ))}
                </Select>
                <Select name="provider" label="Provider" required>
                  <option value="telus">TELUS eClaims</option>
                  <option value="manual">Manual / Paper</option>
                </Select>
                <Field name="service_date" label="Service Date" type="date" required />
                <Field name="service_code" label="Service Code" defaultValue="21000" />
                <Field name="diagnosis_code" label="Diagnosis Code (optional)" />
                <Field name="amount_submitted" label="Amount Submitted CAD" type="number" required defaultValue="120" />
                <SubmitButton>Create Claim</SubmitButton>
              </form>
            }
            list={
              <div className="grid gap-3">
                {insuranceClaims.length ? insuranceClaims.map((claim) => (
                  <div key={claim.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white p-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{claim.client_name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {claim.provider === "telus" ? "TELUS eClaims" : "Manual"} · ${claim.amount_submitted} submitted
                        {claim.amount_approved_cents > 0 ? ` · $${claim.amount_approved} approved` : ""}
                      </p>
                      {claim.claim_number ? <p className="mt-1 text-xs text-slate-400">#{claim.claim_number} · {claim.service_date}</p> : null}
                      {claim.response_message ? <p className="mt-1 text-xs text-slate-500 italic">{claim.response_message}</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-skybrand">{claim.status}</span>
                      {claim.status === "draft" ? (
                        <button onClick={() => submitClaimToInsurer(claim.id)} className="secondary-button text-xs">Submit</button>
                      ) : null}
                    </div>
                  </div>
                )) : (
                  <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No claims yet.</p>
                )}
              </div>
            }
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
                  tag: response.status,
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
              {services.length ? (
                <div className="grid gap-3">
                  {services.map((service) => (
                    <div key={service.id} className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">{service.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{service.duration_minutes} min · {dollars(service.price_cents)}</p>
                        </div>
                        <span className="shrink-0 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-skybrand">{service.is_active ? "active" : "hidden"}</span>
                      </div>
                      <label className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={service.requires_intake}
                          onChange={(e) => toggleServiceIntake(service.id, e.target.checked)}
                          className="size-4"
                        />
                        Auto-send intake &amp; consent form when this service is booked
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No services configured.</p>
              )}
            </Panel>
          </div>
        ) : null}
      </div>

      {profileOpen ? (
        <ClientProfilePanel profile={profile} loading={profileLoading} onClose={() => setProfileOpen(false)} />
      ) : null}
    </main>
  );
}

function AuthCard(props: {
  title: string;
  button: string;
  register?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children?: ReactNode;
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
        <Field name="password" label="Password" type="password" required minLength={8} />
      </div>
      {props.register ? <RecaptchaField action="admin-register" /> : null}
      {props.register ? <p className="text-xs text-slate-500">Use at least 8 characters. Common, numeric-only, or easily guessed passwords are rejected.</p> : null}
      <button className="primary-button mt-5 w-full">
        {props.button}
      </button>
      {props.children}
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
  const hours = Array.from({ length: 10 }, (_, index) => index + 8);
  const dates = Array.from({ length: 5 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
  const startMinutes = 8 * 60;
  const rowHeight = 80;

  function minutesFromTime(time: string) {
    const [hour, minute] = time.slice(0, 5).split(":").map(Number);
    return hour * 60 + minute;
  }

  function formatDay(value: string) {
    return new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
  }

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
          <span className="rounded bg-skybrand px-3 py-1.5 text-white">5 days</span>
          <span className="px-3 py-1.5">Open slots</span>
          <span className="px-3 py-1.5">List</span>
        </div>
      </div>

      <div className="hidden min-w-[720px] sm:block">
        <div className="grid grid-cols-[72px_repeat(5,1fr)] border-b border-slate-200 bg-white text-sm">
          <div className="border-r border-slate-200 p-3 text-slate-400">Time</div>
          {dates.map((day) => (
            <div key={day} className="border-r border-slate-200 p-3 font-semibold text-ink last:border-r-0">
              {formatDay(day)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[72px_repeat(5,1fr)] bg-white">
          <div className="border-r border-slate-200">
            {hours.map((hour) => (
              <div key={hour} className="h-20 border-b border-slate-100 px-3 py-2 text-xs text-slate-400">
                {hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`}
              </div>
            ))}
          </div>
          {dates.map((day) => (
            <div key={day} className="relative border-r border-slate-200 last:border-r-0">
              {hours.map((hour) => (
                <div key={hour} className="h-20 border-b border-slate-100" />
              ))}
              {appointments
                .filter((appointment) => appointment.date === day)
                .map((appointment) => {
                  const top = Math.max(0, ((minutesFromTime(appointment.time) - startMinutes) / 60) * rowHeight);
                  const height = Math.max(48, (appointment.duration_minutes / 60) * rowHeight);
                  return (
                    <div
                      key={appointment.id}
                      className="absolute left-2 right-2 overflow-hidden rounded-md border border-skybrand/30 bg-blue-50 p-2 text-xs shadow-sm"
                      style={{ top: `${top}px`, minHeight: `${height}px` }}
                    >
                      <p className="font-semibold text-ink">{appointment.time.slice(0, 5)} {appointment.client_name}</p>
                      <p className="mt-1 text-slate-600">{appointment.service}</p>
                      {appointment.practitioner_name ? <p className="mt-1 text-slate-500">{appointment.practitioner_name}</p> : null}
                      <span className="mt-2 inline-block rounded bg-white px-2 py-1 font-semibold text-skybrand">{appointment.status}</span>
                    </div>
                  );
                })}
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
                {appointment.practitioner_name ? <p className="text-sm text-slate-500">{appointment.practitioner_name}</p> : null}
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
  minLength?: number;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className={`grid gap-1 text-sm font-medium text-slate-700 ${props.className || ""}`}>
      {props.label}
      <input
        name={props.name}
        type={props.type || "text"}
        required={props.required}
        defaultValue={props.value === undefined ? props.defaultValue : undefined}
        value={props.value}
        onChange={props.onChange}
        minLength={props.minLength}
        className="form-input"
      />
    </label>
  );
}

function Select(props: { name: string; label: string; children: ReactNode; required?: boolean; defaultValue?: string }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {props.label}
      <select name={props.name} required={props.required} defaultValue={props.defaultValue} className="form-input">
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

function AppointmentForm({
  clients,
  practitioners,
  onSubmit
}: {
  clients: Client[];
  practitioners: Practitioner[];
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
      <Select name="practitioner" label="Practitioner">
        <option value="">Select practitioner</option>
        {practitioners.map((practitioner) => (
          <option key={practitioner.id} value={practitioner.id}>
            {practitioner.name}
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

function PractitionerForm({ services, onSubmit }: { services: Service[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="first_name" label="First Name" required />
        <Field name="last_name" label="Last Name" required />
      </div>
      <Field name="display_name" label="Display Name" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="email" label="Email" type="email" />
        <Field name="phone" label="Phone" />
      </div>
      <TextArea name="bio" label="Bio" />
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Services Offered
        <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          {services.map((service) => (
            <label key={service.id} className="flex items-center gap-2 font-normal text-slate-700">
              <input name="service_ids" type="checkbox" value={service.id} className="size-4" />
              {service.name}
            </label>
          ))}
        </div>
      </label>
      <SubmitButton>Save Practitioner</SubmitButton>
    </form>
  );
}

function AvailabilityForm({ practitioners, onSubmit }: { practitioners: Practitioner[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Select name="practitioner" label="Practitioner" required>
        <option value="">Select practitioner</option>
        {practitioners.map((practitioner) => (
          <option key={practitioner.id} value={practitioner.id}>
            {practitioner.name}
          </option>
        ))}
      </Select>
      <Select name="weekday" label="Day" required>
        <option value="0">Monday</option>
        <option value="1">Tuesday</option>
        <option value="2">Wednesday</option>
        <option value="3">Thursday</option>
        <option value="4">Friday</option>
        <option value="5">Saturday</option>
        <option value="6">Sunday</option>
      </Select>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="start_time" label="Start" type="time" required defaultValue="09:00" />
        <Field name="end_time" label="End" type="time" required defaultValue="17:00" />
      </div>
      <SubmitButton>Save Availability</SubmitButton>
    </form>
  );
}

const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SLOT_OPTION_CHOICES = [15, 30, 45, 60, 75, 90, 120];

function ScheduleSettings({
  practitioners,
  onSaveSettings,
  onAddAvailability,
  onDeleteAvailability,
}: {
  practitioners: Practitioner[];
  onSaveSettings: (id: number, payload: { slot_duration_minutes: number; buffer_minutes: number; slot_duration_options: number[] }) => void;
  onAddAvailability: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteAvailability: (practitionerId: number, availabilityId: number) => void;
}) {
  const [selectedId, setSelectedId] = useState<number | "">(practitioners[0]?.id ?? "");
  const selected = practitioners.find((p) => p.id === selectedId) ?? practitioners[0];

  if (!practitioners.length) {
    return (
      <div className="mt-6 rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        Add a practitioner in the Team tab first, then configure their schedule here.
      </div>
    );
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const options = SLOT_OPTION_CHOICES.filter((n) => form.get(`opt_${n}`) === "on");
    onSaveSettings(selected.id, {
      slot_duration_minutes: Number(form.get("slot_duration_minutes")),
      buffer_minutes: Number(form.get("buffer_minutes")),
      slot_duration_options: options.length ? options : [60],
    });
  }

  return (
    <div className="mt-6 grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-ink">Practitioner</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : "")}
          className="form-input max-w-xs"
        >
          {practitioners.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {selected ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Slot Settings">
            <form onSubmit={saveSettings} className="grid gap-4" key={selected.id}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="slot_duration_minutes" label="Default slot length (min)" type="number" required defaultValue={String(selected.slot_duration_minutes)} />
                <Field name="buffer_minutes" label="Buffer between slots (min)" type="number" required defaultValue={String(selected.buffer_minutes)} />
              </div>
              <div className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Bookable slot durations</span>
                <div className="flex flex-wrap gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  {SLOT_OPTION_CHOICES.map((n) => (
                    <label key={n} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name={`opt_${n}`} defaultChecked={selected.slot_duration_options?.includes(n)} className="size-4" />
                      {n}m
                    </label>
                  ))}
                </div>
              </div>
              <SubmitButton>Save Slot Settings</SubmitButton>
            </form>
          </Panel>

          <div className="grid gap-6">
            <Panel title="Weekly Availability">
              {selected.availability?.length ? (
                <div className="grid gap-2">
                  {selected.availability.map((block) => (
                    <div key={block.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
                      <span className="font-medium text-ink">{WEEKDAY_LABELS[block.weekday]}</span>
                      <span className="text-slate-600">{block.start_time.slice(0, 5)} – {block.end_time.slice(0, 5)}</span>
                      <button onClick={() => onDeleteAvailability(selected.id, block.id)} className="icon-button text-red-600" title="Remove"><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No availability set. Add a day below.</p>
              )}
            </Panel>
            <Panel title="Add Availability">
              <form onSubmit={onAddAvailability} className="grid gap-4">
                <input type="hidden" name="practitioner" value={selected.id} />
                <Select name="weekday" label="Day" required>
                  {WEEKDAY_LABELS.map((label, i) => (
                    <option key={label} value={i}>{label}</option>
                  ))}
                </Select>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="start_time" label="Start" type="time" required defaultValue="09:00" />
                  <Field name="end_time" label="End" type="time" required defaultValue="17:00" />
                </div>
                <SubmitButton>Add Day</SubmitButton>
              </form>
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="payment_provider" label="Payment Provider" defaultValue={clinic.payment_provider}>
          <option value="stripe">Stripe</option>
          <option value="square">Square</option>
        </Select>
        <Select name="booking_payment_mode" label="Booking Payment Mode" defaultValue={clinic.booking_payment_mode}>
          <option value="none">None</option>
          <option value="deposit">Deposit</option>
          <option value="card_on_file">Card on file</option>
          <option value="full_payment">Full payment</option>
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input name="deposit_required" type="checkbox" defaultChecked={clinic.deposit_required} className="size-4" />
        Require deposit for online booking
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input name="card_on_file_required" type="checkbox" defaultChecked={clinic.card_on_file_required} className="size-4" />
        Require secure card on file
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input name="reminders_enabled" type="checkbox" defaultChecked={clinic.reminders_enabled} className="size-4" />
        Enable appointment reminders
      </label>
      <Field name="reminder_email" label="Reminder From Email" type="email" defaultValue={clinic.reminder_email} />
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input name="sms_enabled" type="checkbox" defaultChecked={clinic.sms_enabled} className="size-4" />
        Enable SMS reminders (requires Twilio config)
      </label>
      <div className="border-t border-slate-100 pt-4">
        <p className="mb-3 text-sm font-semibold text-ink">No-Show Protection</p>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input name="noshow_protection_enabled" type="checkbox" defaultChecked={clinic.noshow_protection_enabled} className="size-4" />
          Charge no-show fee when appointment is marked as no-show
        </label>
        <div className="mt-3">
          <Field name="noshow_fee" label="No-Show Fee CAD" type="number" defaultValue={String(clinic.noshow_fee_cents / 100)} />
        </div>
      </div>
      <SubmitButton>Save Settings</SubmitButton>
    </form>
  );
}
