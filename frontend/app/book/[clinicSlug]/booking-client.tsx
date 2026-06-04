"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api, Clinic, Service } from "@/lib/api";
import { CalendarCheck, CheckCircle2, CreditCard, FileText, UserRound } from "lucide-react";

function dollars(cents: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

export default function BookingClient({ clinicSlug }: { clinicSlug: string }) {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState<{ appointment_id: number; message: string } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const availability = await api.publicAvailability(clinicSlug);
        setClinic(availability.clinic);
        setServices(availability.clinic.services.filter((service) => service.is_active));
        setTimes(availability.available_times);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load booking page.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [clinicSlug]);

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("");
    try {
      const response = await api.publicBook(clinicSlug, {
        service_id: Number(form.get("service_id")),
        date: String(form.get("date")),
        time: String(form.get("time")),
        first_name: String(form.get("first_name")),
        last_name: String(form.get("last_name")),
        email: String(form.get("email")),
        phone: String(form.get("phone")),
        health_history: String(form.get("health_history")),
        consent_accepted: form.get("consent_accepted") === "on",
        pay_deposit: form.get("pay_deposit") === "on",
      });
      setConfirmed({ appointment_id: response.appointment_id, message: response.message });
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not book appointment.");
    }
  }

  if (loading) {
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
          <Link href={`/book/${clinic.slug}`} className="primary-button mt-6">
            Book Another Appointment
          </Link>
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
            <p className="mt-2 text-slate-600">{clinic.address || "Choose a service and request an appointment time."}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:px-8">
        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Before you book</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-600">
            <span className="flex gap-2">
              <CalendarCheck size={18} className="text-skybrand" /> Pick a service and preferred time.
            </span>
            <span className="flex gap-2">
              <UserRound size={18} className="text-skybrand" /> Enter your contact info.
            </span>
            <span className="flex gap-2">
              <FileText size={18} className="text-skybrand" /> Complete intake and consent.
            </span>
            <span className="flex gap-2">
              <CreditCard size={18} className="text-skybrand" /> Pay deposit if the clinic requires one.
            </span>
          </div>
          <div className="mt-5 rounded-md bg-slate-50 p-3 text-sm text-slate-600">{clinic.booking_policy}</div>
        </aside>

        <form onSubmit={submitBooking} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-ink">Request Appointment</h2>
          {message ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}

          <div className="mt-5 grid gap-4">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Service
              <select name="service_id" required className="form-input">
                <option value="">Select service</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} - {service.duration_minutes} min - {dollars(service.price_cents)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Preferred Date
                <input name="date" type="date" required className="form-input" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Preferred Time
                <select name="time" required className="form-input">
                  <option value="">Select time</option>
                  {times.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                First Name
                <input name="first_name" required className="form-input" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Last Name
                <input name="last_name" required className="form-input" />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Email
                <input name="email" type="email" required className="form-input" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Phone
                <input name="phone" className="form-input" />
              </label>
            </div>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Health History / Reason for Visit
              <textarea name="health_history" rows={4} className="form-textarea" />
            </label>
            <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input name="consent_accepted" type="checkbox" required className="mt-1 size-4" />
              <span>I consent to treatment policies and confirm this intake information is accurate.</span>
            </label>
            {clinic.deposit_required ? (
              <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <input name="pay_deposit" type="checkbox" className="mt-1 size-4" />
                <span>I understand a {dollars(clinic.deposit_amount_cents)} deposit may be collected to confirm this booking.</span>
              </label>
            ) : null}
            <button className="primary-button w-full sm:w-auto">Confirm Request</button>
          </div>
        </form>
      </div>
    </main>
  );
}
