"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Appointment, Client, IntakeResponse, Practitioner, Service } from "@/lib/api";

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;
const ROW_HEIGHT = 56; // px per hour

type BookingSeed = {
  date: string;
  time: string;
  practitionerId?: number | null;
  clientId?: number | null;
};

type Props = {
  appointments: Appointment[];
  clients: Client[];
  practitioners: Practitioner[];
  services: Service[];
  intakeResponses: IntakeResponse[];
  onCreate: (payload: Partial<Appointment>) => Promise<void>;
  onUpdate: (id: number, payload: Partial<Appointment>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onSendReminder: (id: number) => Promise<{ sent: boolean; to: string }>;
  setMessage: (msg: string) => void;
};

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function minutesFromTime(time: string) {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-900",
  confirmed: "border-skybrand/40 bg-blue-50 text-ink",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-900",
  cancelled: "border-slate-300 bg-slate-100 text-slate-500 line-through",
  no_show: "border-red-300 bg-red-50 text-red-900",
};

export default function CalendarTab(props: Props) {
  const { appointments, clients, practitioners, services, intakeResponses } = props;
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [practitionerFilter, setPractitionerFilter] = useState<string>("");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [booking, setBooking] = useState<BookingSeed | null>(null);
  const [busy, setBusy] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );

  const hours = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i),
    []
  );

  const visible = useMemo(() => {
    const dayKeys = new Set(days.map(iso));
    return appointments.filter(
      (a) => dayKeys.has(a.date) && (!practitionerFilter || String(a.practitioner) === practitionerFilter)
    );
  }, [appointments, days, practitionerFilter]);

  const weekLabel = `${days[0].toLocaleDateString("en-CA", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}`;

  function shiftWeek(deltaWeeks: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + deltaWeeks * 7);
    setWeekStart(d);
  }

  function intakeFor(appointmentId: number): IntakeResponse | undefined {
    return intakeResponses.find((r) => r.appointment === appointmentId);
  }

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-1)} className="icon-button" title="Previous week"><ChevronLeft size={18} /></button>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="secondary-button text-sm">Today</button>
          <button onClick={() => shiftWeek(1)} className="icon-button" title="Next week"><ChevronRight size={18} /></button>
          <span className="ml-2 text-sm font-semibold text-ink">{weekLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={practitionerFilter}
            onChange={(e) => setPractitionerFilter(e.target.value)}
            className="form-input min-h-9 py-1 text-sm"
          >
            <option value="">All practitioners</option>
            {practitioners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={() => setBooking({ date: iso(days[0]), time: "09:00", practitionerId: practitionerFilter ? Number(practitionerFilter) : null })}
            className="primary-button text-sm"
          >
            <CalendarPlus size={16} /> New
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <div className="min-w-[820px]">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200">
            <div className="p-2 text-xs text-slate-400">Time</div>
            {days.map((d) => {
              const isToday = iso(d) === iso(new Date());
              return (
                <div key={iso(d)} className={`border-l border-slate-200 p-2 text-center text-sm font-semibold ${isToday ? "bg-blue-50 text-skybrand" : "text-ink"}`}>
                  {d.toLocaleDateString("en-CA", { weekday: "short" })}{" "}
                  <span className="text-slate-400">{d.getDate()}</span>
                </div>
              );
            })}
          </div>
          {/* Body */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)]">
            {/* time gutter */}
            <div>
              {hours.map((h) => (
                <div key={h} style={{ height: ROW_HEIGHT }} className="border-b border-slate-100 px-2 pt-1 text-[11px] text-slate-400">
                  {h > 12 ? `${h - 12}p` : h === 12 ? "12p" : `${h}a`}
                </div>
              ))}
            </div>
            {days.map((day) => {
              const dayAppts = visible.filter((a) => a.date === iso(day));
              return (
                <div key={iso(day)} className="relative border-l border-slate-200">
                  {/* clickable hour cells */}
                  {hours.map((h) => (
                    <button
                      key={h}
                      onClick={() => setBooking({ date: iso(day), time: `${String(h).padStart(2, "0")}:00`, practitionerId: practitionerFilter ? Number(practitionerFilter) : null })}
                      style={{ height: ROW_HEIGHT }}
                      className="block w-full border-b border-slate-100 transition hover:bg-blue-50/40"
                      title="Click to book"
                    />
                  ))}
                  {/* appointment blocks */}
                  {dayAppts.map((a) => {
                    const top = ((minutesFromTime(a.time) - DAY_START_HOUR * 60) / 60) * ROW_HEIGHT;
                    const height = Math.max(22, (a.duration_minutes / 60) * ROW_HEIGHT - 2);
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelected(a)}
                        style={{ top: Math.max(0, top), height }}
                        className={`absolute left-1 right-1 overflow-hidden rounded border px-1.5 py-1 text-left text-[11px] shadow-sm transition hover:shadow ${STATUS_COLORS[a.status] || STATUS_COLORS.confirmed}`}
                      >
                        <span className="block font-semibold leading-tight">{a.time.slice(0, 5)} {a.client_name}</span>
                        <span className="block truncate opacity-80">{a.service}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Management drawer */}
      {selected ? (
        <ManagementPanel
          appointment={selected}
          clients={clients}
          practitioners={practitioners}
          services={services}
          intake={intakeFor(selected.id)}
          busy={busy}
          onClose={() => setSelected(null)}
          onMarkStatus={(status) => withBusy(async () => {
            await props.onUpdate(selected.id, { status });
            setSelected({ ...selected, status });
            props.setMessage(`Marked ${status.replace("_", " ")}.`);
          })}
          onSave={(payload) => withBusy(async () => {
            await props.onUpdate(selected.id, payload);
            props.setMessage("Appointment updated.");
            setSelected(null);
          })}
          onDelete={() => withBusy(async () => {
            await props.onDelete(selected.id);
            props.setMessage("Appointment deleted.");
            setSelected(null);
          })}
          onSendReminder={() => withBusy(async () => {
            const res = await props.onSendReminder(selected.id);
            props.setMessage(res.sent ? `Reminder emailed to ${res.to}.` : `Reminder queued (email not configured locally).`);
          })}
          onRebook={() => {
            setBooking({ date: iso(new Date()), time: "09:00", practitionerId: selected.practitioner, clientId: selected.client });
            setSelected(null);
          }}
        />
      ) : null}

      {/* Booking modal */}
      {booking ? (
        <BookingModal
          seed={booking}
          clients={clients}
          practitioners={practitioners}
          services={services}
          busy={busy}
          onClose={() => setBooking(null)}
          onCreate={(payload) => withBusy(async () => {
            await props.onCreate(payload);
            props.setMessage("Appointment booked.");
            setBooking(null);
          })}
        />
      ) : null}
    </div>
  );
}

function ManagementPanel(props: {
  appointment: Appointment;
  clients: Client[];
  practitioners: Practitioner[];
  services: Service[];
  intake?: IntakeResponse;
  busy: boolean;
  onClose: () => void;
  onMarkStatus: (status: Appointment["status"]) => void;
  onSave: (payload: Partial<Appointment>) => void;
  onDelete: () => void;
  onSendReminder: () => void;
  onRebook: () => void;
}) {
  const a = props.appointment;
  const [editing, setEditing] = useState(false);

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    props.onSave({
      service: String(form.get("service")),
      date: String(form.get("date")),
      time: String(form.get("time")),
      duration_minutes: Number(form.get("duration_minutes")),
      practitioner: form.get("practitioner") ? Number(form.get("practitioner")) : null,
      status: String(form.get("status")) as Appointment["status"],
      notes: String(form.get("notes")),
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={props.onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Appointment</h2>
          <button onClick={props.onClose} className="icon-button"><X size={18} /></button>
        </div>

        {!editing ? (
          <>
            <div className="mt-4 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-base font-semibold text-ink">{a.client_name}</p>
              <p className="text-slate-600">{a.service} · {a.duration_minutes} min</p>
              <p className="text-slate-600">{a.date} at {a.time.slice(0, 5)}</p>
              <p className="text-slate-600">{a.practitioner_name || "No practitioner"}</p>
              <span className="w-fit rounded bg-white px-2 py-1 text-xs font-semibold text-skybrand">{a.status}</span>
            </div>

            {/* Intake status */}
            <div className="mt-3 flex items-center gap-2 rounded-md border border-slate-200 p-3 text-sm">
              <FileText size={16} className={props.intake ? "text-emerald-600" : "text-amber-500"} />
              {props.intake
                ? <span className="text-slate-700">Health history: <span className="font-semibold">{props.intake.status}</span>{props.intake.consent_accepted ? " · consent ✓" : " · consent missing"}</span>
                : <span className="text-amber-700">No intake form on file for this appointment.</span>}
            </div>

            {/* Actions */}
            <div className="mt-4 grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button disabled={props.busy} onClick={() => props.onMarkStatus("confirmed")} className="secondary-button justify-center text-sm"><Check size={15} /> Confirm</button>
                <button disabled={props.busy} onClick={() => props.onMarkStatus("completed")} className="secondary-button justify-center text-sm"><Check size={15} /> Arrived</button>
              </div>
              <button disabled={props.busy} onClick={props.onSendReminder} className="secondary-button justify-center text-sm"><Send size={15} /> Send reminder</button>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={props.busy} onClick={() => setEditing(true)} className="secondary-button justify-center text-sm"><Pencil size={15} /> Edit</button>
                <button disabled={props.busy} onClick={props.onRebook} className="secondary-button justify-center text-sm"><RotateCcw size={15} /> Rebook</button>
              </div>
              <button disabled={props.busy} onClick={props.onDelete} className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"><Trash2 size={15} /> Delete</button>
            </div>
          </>
        ) : (
          <form onSubmit={submitEdit} className="mt-4 grid gap-3 text-sm">
            <label className="grid gap-1 font-medium text-slate-700">Service
              <input name="service" defaultValue={a.service} required className="form-input" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="grid gap-1 font-medium text-slate-700">Date
                <input name="date" type="date" defaultValue={a.date} required className="form-input" />
              </label>
              <label className="grid gap-1 font-medium text-slate-700">Time
                <input name="time" type="time" defaultValue={a.time.slice(0, 5)} required className="form-input" />
              </label>
              <label className="grid gap-1 font-medium text-slate-700">Min
                <input name="duration_minutes" type="number" defaultValue={a.duration_minutes} required className="form-input" />
              </label>
            </div>
            <label className="grid gap-1 font-medium text-slate-700">Practitioner
              <select name="practitioner" defaultValue={a.practitioner ?? ""} className="form-input">
                <option value="">None</option>
                {props.practitioners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 font-medium text-slate-700">Status
              <select name="status" defaultValue={a.status} className="form-input">
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
            </label>
            <label className="grid gap-1 font-medium text-slate-700">Notes
              <textarea name="notes" defaultValue={a.notes} rows={2} className="form-textarea" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEditing(false)} className="secondary-button justify-center">Cancel</button>
              <button type="submit" disabled={props.busy} className="primary-button justify-center">Save</button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}

function BookingModal(props: {
  seed: BookingSeed;
  clients: Client[];
  practitioners: Practitioner[];
  services: Service[];
  busy: boolean;
  onClose: () => void;
  onCreate: (payload: Partial<Appointment>) => void;
}) {
  const defaultService = props.services[0];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    props.onCreate({
      client: Number(form.get("client")),
      practitioner: form.get("practitioner") ? Number(form.get("practitioner")) : null,
      service: String(form.get("service")),
      date: String(form.get("date")),
      time: String(form.get("time")),
      duration_minutes: Number(form.get("duration_minutes")),
      status: String(form.get("status")) as Appointment["status"],
      notes: String(form.get("notes")),
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-4" onClick={props.onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink"><Clock size={18} className="text-skybrand" /> Book appointment</h2>
          <button onClick={props.onClose} className="icon-button"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="mt-4 grid gap-3 text-sm">
          <label className="grid gap-1 font-medium text-slate-700">Client
            <select name="client" defaultValue={props.seed.clientId ?? ""} required className="form-input">
              <option value="">Select client</option>
              {props.clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 font-medium text-slate-700">Practitioner
            <select name="practitioner" defaultValue={props.seed.practitionerId ?? ""} className="form-input">
              <option value="">None</option>
              {props.practitioners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 font-medium text-slate-700">Service
            <input name="service" defaultValue={defaultService?.name || "Massage Therapy"} required className="form-input" />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-1 font-medium text-slate-700">Date
              <input name="date" type="date" defaultValue={props.seed.date} required className="form-input" />
            </label>
            <label className="grid gap-1 font-medium text-slate-700">Time
              <input name="time" type="time" defaultValue={props.seed.time} required className="form-input" />
            </label>
            <label className="grid gap-1 font-medium text-slate-700">Min
              <input name="duration_minutes" type="number" defaultValue={defaultService?.duration_minutes || 60} required className="form-input" />
            </label>
          </div>
          <label className="grid gap-1 font-medium text-slate-700">Status
            <select name="status" defaultValue="confirmed" className="form-input">
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="grid gap-1 font-medium text-slate-700">Notes
            <textarea name="notes" rows={2} className="form-textarea" />
          </label>
          <button type="submit" disabled={props.busy} className="primary-button justify-center">Book appointment</button>
        </form>
      </div>
    </div>
  );
}
