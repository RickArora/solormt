"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, Clinic, Practitioner, Service } from "@/lib/api";
import { CalendarCheck, CheckCircle2, CreditCard, FileText, LockKeyhole, UserRound } from "lucide-react";

type Slot = { date: string; time: string; practitioner_id: number; practitioner_name: string };

function dollars(cents: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

export default function BookingClient({ clinicSlug }: { clinicSlug: string }) {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedService, setSelectedService] = useState("");
  const [selectedPractitioner, setSelectedPractitioner] = useState("");
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState<{
    appointment_id: number;
    message: string;
    checkout_url: string;
    client_access: string;
    client_refresh: string;
  } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const availability = await api.publicAvailabilityFor(
          clinicSlug,
          selectedService ? Number(selectedService) : undefined,
          selectedPractitioner ? Number(selectedPractitioner) : undefined
        );
        setClinic(availability.clinic);
        setServices(availability.clinic.services.filter((service) => service.is_active));
        setPractitioners(availability.practitioners);
        setSlots(availability.available_slots);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load booking page.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [clinicSlug, selectedService, selectedPractitioner]);

  const selectedServiceRecord = useMemo(
    () => services.find((service) => String(service.id) === selectedService),
    [services, selectedService]
  );

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const slotValue = String(form.get("slot"));
    const [date, time] = slotValue.split("|");
    setMessage("");
    try {
      const response = await api.publicBook(clinicSlug, {
        auth_mode: authMode,
        service_id: Number(form.get("service_id")),
        practitioner_id: Number(form.get("practitioner_id")),
        date,
        time,
        first_name: String(form.get("first_name")),
        last_name: String(form.get("last_name")),
        email: String(form.get("email")),
        password: String(form.get("password")),
        phone: String(form.get("phone")),
        health_history: String(form.get("health_history")),
        consent_accepted: form.get("consent_accepted") === "on",
        pay_deposit: form.get("pay_deposit") === "on",
        save_card: form.get("save_card") === "on",
      });
      if (response.client_access) {
        window.localStorage.setItem(`solormt_client_access_${clinicSlug}`, response.client_access);
        window.localStorage.setItem(`solormt_client_refresh_${clinicSlug}`, response.client_refresh);
      }
      setConfirmed(response);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not book appointment.");
    }
  }

  if (loading && !clinic) {
    return <main className="min-h-screen bg-[#f7fbff] p-6 text-slate-600">Loading booking page...</main>;
  }

  if (!clinic) {
    return <main className="min-h-screen bg-[#f7fbff] p-6 text-slate-600">{message || "Clinic not found."}</main>;
  }

  if (confirmed) {
    return (
      <main className="min-h-screen bg-[#f7fbff] px-4 py-10">
        <section className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-soft">
          <CheckCircle2 className="mx-auto text-emerald-600" size={42} />
          <h1 className="mt-4 text-2xl font-semibold text-ink">Appointment request received</h1>
          <p className="mt-3 text-slate-600">{confirmed.message}</p>
          <p className="mt-3 text-sm text-slate-500">Reference #{confirmed.appointment_id}</p>
          {confirmed.checkout_url ? (
            <a href={confirmed.checkout_url} className="primary-button mt-6">
              Continue To Secure Payment
            </a>
          ) : null}
          <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={`/client/${clinic.slug}`} className="secondary-button">
              Open Client Portal
            </Link>
            <Link href={`/book/${clinic.slug}`} className="secondary-button">
              Book Another Appointment
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7fbff]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold text-ink">
            <span className="grid size-9 place-items-center rounded-md bg-skybrand text-white">S</span>
            SoloRMT
          </Link>
          <div>
            <p className="text-sm font-semibold text-skybrand">Online Booking</p>
            <h1 className="text-3xl font-semibold text-ink">{clinic.name}</h1>
            <p className="mt-2 text-slate-600">{clinic.address || "Choose a practitioner and request an appointment time."}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Booking Steps</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-600">
            <span className="flex gap-2"><CalendarCheck size={18} className="text-skybrand" /> Choose service, practitioner, and time.</span>
            <span className="flex gap-2"><LockKeyhole size={18} className="text-skybrand" /> Create or log into your client portal.</span>
            <span className="flex gap-2"><FileText size={18} className="text-skybrand" /> Complete health history and consent.</span>
            <span className="flex gap-2"><CreditCard size={18} className="text-skybrand" /> Stripe collects deposits or cards securely.</span>
            <span className="flex gap-2"><UserRound size={18} className="text-skybrand" /> Reminders are queued without health details.</span>
          </div>
          <div className="mt-5 rounded-md bg-slate-50 p-3 text-sm text-slate-600">{clinic.booking_policy}</div>
        </aside>

        <form onSubmit={submitBooking} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-ink">Schedule Appointment</h2>
          {message ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}

          <div className="mt-5 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Service
                <select name="service_id" required className="form-input" value={selectedService} onChange={(event) => setSelectedService(event.target.value)}>
                  <option value="">Select service</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - {service.duration_minutes} min - {dollars(service.price_cents)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Practitioner
                <select
                  name="practitioner_id"
                  required
                  className="form-input"
                  value={selectedPractitioner}
                  onChange={(event) => setSelectedPractitioner(event.target.value)}
                >
                  <option value="">Select practitioner</option>
                  {practitioners.map((practitioner) => (
                    <option key={practitioner.id} value={practitioner.id}>
                      {practitioner.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Available Time
              <select name="slot" required className="form-input" disabled={!selectedService || !selectedPractitioner}>
                <option value="">Select time</option>
                {slots.map((slot) => (
                  <option key={`${slot.date}-${slot.time}-${slot.practitioner_id}`} value={`${slot.date}|${slot.time}`}>
                    {slot.date} at {slot.time}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
              <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
                <button type="button" onClick={() => setAuthMode("register")} className={`rounded-md px-3 py-2 ${authMode === "register" ? "bg-white text-skybrand shadow-sm" : "text-slate-600"}`}>
                  New Client
                </button>
                <button type="button" onClick={() => setAuthMode("login")} className={`rounded-md px-3 py-2 ${authMode === "login" ? "bg-white text-skybrand shadow-sm" : "text-slate-600"}`}>
                  Returning Client
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                First Name
                <input name="first_name" required={authMode === "register"} className="form-input" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Last Name
                <input name="last_name" required={authMode === "register"} className="form-input" />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Email
                <input name="email" type="email" required className="form-input" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Password
                <input name="password" type="password" required minLength={8} className="form-input" />
              </label>
            </div>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Phone
              <input name="phone" className="form-input" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Health History / Reason for Visit
              <textarea name="health_history" rows={4} className="form-textarea" />
            </label>
            <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input name="consent_accepted" type="checkbox" required className="mt-1 size-4" />
              <span>I consent to treatment policies and confirm this intake information is accurate.</span>
            </label>
            {clinic.booking_payment_mode !== "none" || clinic.deposit_required || clinic.card_on_file_required ? (
              <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <input name={clinic.booking_payment_mode === "card_on_file" ? "save_card" : "pay_deposit"} type="checkbox" required className="mt-1 size-4" />
                <span>
                  I understand {clinic.payment_provider === "stripe" ? "Stripe" : "Square"} may securely collect{" "}
                  {clinic.booking_payment_mode === "card_on_file" ? "a card on file" : selectedServiceRecord ? `${dollars(clinic.deposit_amount_cents || selectedServiceRecord.price_cents)}` : "payment"}.
                </span>
              </label>
            ) : null}
            <button className="primary-button w-full sm:w-auto">Confirm Appointment Request</button>
          </div>
        </form>
      </div>
    </main>
  );
}
