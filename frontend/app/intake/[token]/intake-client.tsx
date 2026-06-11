"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, FileText } from "lucide-react";
import { api, PublicIntake } from "@/lib/api";

export default function IntakeClient({ token }: { token: string }) {
  const [data, setData] = useState<PublicIntake | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const result = await api.publicIntake(token);
        setData(result);
        setDone(result.completed);
      } catch {
        setError("This intake link is invalid or has expired.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    try {
      await api.submitPublicIntake(token, {
        health_history: String(form.get("health_history")),
        consent_accepted: form.get("consent_accepted") === "on",
      });
      setDone(true);
    } catch {
      setError("Could not submit the form. Please check your answers and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f7fbff] p-6 text-slate-600">Loading intake form…</main>;
  }

  if (error && !data) {
    return <main className="min-h-screen bg-[#f7fbff] p-6 text-slate-600">{error}</main>;
  }

  if (done) {
    return (
      <main className="min-h-screen bg-[#f7fbff] px-4 py-10">
        <section className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-soft">
          <CheckCircle2 className="mx-auto text-emerald-600" size={42} />
          <h1 className="mt-4 text-2xl font-semibold text-ink">Intake form complete</h1>
          <p className="mt-3 text-slate-600">Thank you — your health history and consent are on file for {data?.clinic_name}.</p>
        </section>
      </main>
    );
  }

  if (data && !data.editable && !data.completed) {
    return (
      <main className="min-h-screen bg-[#f7fbff] px-4 py-10">
        <section className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-soft">
          <FileText className="mx-auto text-amber-500" size={42} />
          <h1 className="mt-4 text-2xl font-semibold text-ink">This intake link has expired</h1>
          <p className="mt-3 text-slate-600">For your privacy, intake links are time-limited. Please contact {data?.clinic_name} to request a new link.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7fbff] px-4 py-10">
      <section className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <p className="flex items-center gap-2 text-sm font-semibold text-skybrand"><FileText size={17} /> Intake & Consent</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">{data?.clinic_name}</h1>
        <p className="mt-1 text-slate-600">
          Hi {data?.client_first_name}, please complete this before your visit
          {data?.appointment_date ? ` on ${data.appointment_date} at ${data.appointment_time}` : ""}.
        </p>

        {error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <form onSubmit={submit} className="mt-5 grid gap-4">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Health history / reason for visit
            <textarea name="health_history" rows={6} defaultValue={data?.health_history} className="form-textarea" placeholder="Conditions, injuries, medications, areas of concern…" />
          </label>
          <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <input name="consent_accepted" type="checkbox" required defaultChecked={data?.consent_accepted} className="mt-1 size-4" />
            <span>I consent to treatment and confirm this intake information is accurate.</span>
          </label>
          <button disabled={submitting} className="primary-button justify-center">{submitting ? "Submitting…" : "Submit intake form"}</button>
        </form>
      </section>
    </main>
  );
}
