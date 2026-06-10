"use client";

import { ReactNode } from "react";
import { Bell, CalendarClock, CreditCard, FileText, MessageSquare, ReceiptText, ShieldCheck, X } from "lucide-react";
import { ClientProfile } from "@/lib/api";

function fmt(dt: string | null): string {
  if (!dt) return "—";
  const d = new Date(dt);
  return d.toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function dollars(cents: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

const STATUS_PILL: Record<string, string> = {
  sent: "bg-amber-50 text-amber-700",
  queued: "bg-slate-100 text-slate-600",
  completed: "bg-emerald-50 text-emerald-700",
  confirmed: "bg-blue-50 text-skybrand",
  cancelled: "bg-slate-100 text-slate-500",
  no_show: "bg-red-50 text-red-700",
  paid: "bg-emerald-50 text-emerald-700",
  unpaid: "bg-amber-50 text-amber-700",
};

function Pill({ value }: { value: string }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_PILL[value] || "bg-slate-100 text-slate-600"}`}>{value}</span>;
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">{icon} {title}</h3>
      <div className="mt-2 grid gap-2">{children}</div>
    </section>
  );
}

export default function ClientProfilePanel({ profile, loading, onClose }: { profile: ClientProfile | null; loading: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Client Profile</h2>
          <button onClick={onClose} className="icon-button"><X size={18} /></button>
        </div>

        {loading || !profile ? (
          <p className="mt-6 text-sm text-slate-500">Loading profile…</p>
        ) : (
          <>
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-base font-semibold text-ink">{profile.client.first_name} {profile.client.last_name}</p>
              <p className="text-sm text-slate-600">{profile.client.email || "No email"}{profile.client.phone ? ` · ${profile.client.phone}` : ""}</p>
              {profile.client.insurance_company ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><ShieldCheck size={13} /> {profile.client.insurance_company} · member {profile.client.insurance_member_id || "—"}</p>
              ) : null}
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <MessageSquare size={13} /> SMS reminders: <span className={profile.client.sms_opt_in ? "font-semibold text-emerald-700" : "text-slate-500"}>{profile.client.sms_opt_in ? "opted in" : "not opted in"}</span>
              </p>
            </div>

            {/* Intake / clinic forms — sent + filled status, Jane-style */}
            <Section icon={<FileText size={15} className="text-skybrand" />} title="Clinic Forms">
              {profile.intake_responses.length ? profile.intake_responses.map((i) => (
                <div key={i.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink">Health history & consent</span>
                    <Pill value={i.status} />
                  </div>
                  <div className="mt-1 grid gap-0.5 text-xs text-slate-500">
                    <span>Sent: {fmt(i.sent_at)}</span>
                    {i.reminder_sent_at ? <span>Reminder sent: {fmt(i.reminder_sent_at)}</span> : null}
                    <span>{i.completed_at ? `Filled out: ${fmt(i.completed_at)}` : "Not filled out yet"}</span>
                  </div>
                </div>
              )) : <Empty text="No forms sent." />}
            </Section>

            {/* Communication log — reminders */}
            <Section icon={<Bell size={15} className="text-skybrand" />} title="Reminders Sent">
              {profile.reminders.length ? profile.reminders.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 p-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{r.kind_label} <span className="text-xs font-normal text-slate-400">· {r.channel}</span></p>
                    <p className="text-xs text-slate-500">{fmt(r.scheduled_for)}{r.appointment_date ? ` · for ${r.appointment_date}` : ""}</p>
                  </div>
                  <Pill value={r.status} />
                </div>
              )) : <Empty text="No reminders yet." />}
            </Section>

            {/* Appointments */}
            <Section icon={<CalendarClock size={15} className="text-skybrand" />} title="Appointments">
              {profile.appointments.length ? profile.appointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 p-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{a.date} at {a.time.slice(0, 5)}</p>
                    <p className="text-xs text-slate-500">{a.service}{a.practitioner_name ? ` · ${a.practitioner_name}` : ""}</p>
                  </div>
                  <Pill value={a.status} />
                </div>
              )) : <Empty text="No appointments." />}
            </Section>

            {/* Payments */}
            <Section icon={<CreditCard size={15} className="text-skybrand" />} title="Payments">
              {profile.payments.length ? profile.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 p-2.5 text-sm">
                  <span className="font-medium text-ink">{dollars(p.amount_cents)} <span className="text-xs font-normal text-slate-400">· {p.kind}</span></span>
                  <Pill value={p.status} />
                </div>
              )) : <Empty text="No payments." />}
            </Section>

            {/* SOAP notes */}
            <Section icon={<ReceiptText size={15} className="text-skybrand" />} title="SOAP Notes">
              {profile.soap_notes.length ? profile.soap_notes.map((n) => (
                <div key={n.id} className="rounded-md border border-slate-200 p-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink">{n.assessment ? n.assessment.slice(0, 40) : "Draft note"}</span>
                    <Pill value={n.is_complete ? "completed" : "sent"} />
                  </div>
                </div>
              )) : <Empty text="No SOAP notes." />}
            </Section>
          </>
        )}
      </aside>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">{text}</p>;
}
