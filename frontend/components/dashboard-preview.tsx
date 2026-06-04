import { appointments, dashboardMetrics, recentActivity } from "@/lib/data";
import { CalendarCheck, CheckCircle2, DollarSign } from "lucide-react";

export function DashboardPreview() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft sm:p-4">
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-skybrand">SoloRMT Dashboard</p>
          <h3 className="mt-1 text-lg font-semibold text-ink sm:text-xl">Today at Lakeside Massage</h3>
        </div>
        <div className="rounded-md bg-mintbrand px-3 py-2 text-xs font-semibold text-emerald-900 sm:text-sm">
          6 confirmed
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        {dashboardMetrics.map((metric, index) => (
          <div key={metric.label} className={`${index > 3 ? "col-span-2 lg:col-span-1" : ""} rounded-md border border-slate-200 bg-slate-50/60 p-3`}>
            <p className="text-[11px] leading-4 text-slate-500 sm:text-xs">{metric.label}</p>
            <p className="mt-2 text-xl font-semibold text-ink sm:text-2xl">{metric.value}</p>
            <p className="mt-1 text-xs text-slate-600">{metric.change}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-md border border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <CalendarCheck aria-hidden="true" size={18} className="text-skybrand" />
            <h4 className="font-semibold">Today's Schedule</h4>
          </div>
          <div className="divide-y divide-slate-100">
            {appointments.map((appointment) => (
              <div key={`${appointment.time}-${appointment.client}`} className="grid grid-cols-[64px_1fr] gap-3 px-3 py-3 text-sm sm:grid-cols-[74px_1fr_auto] sm:px-4">
                <span className="font-medium text-slate-500">{appointment.time}</span>
                <span>
                  <span className="block font-semibold text-ink">{appointment.client}</span>
                  <span className="block text-slate-500">{appointment.service}</span>
                </span>
                <span
                  className={`col-start-2 h-fit w-fit rounded-md px-2 py-1 text-xs font-semibold sm:col-start-auto ${
                    appointment.status === "Confirmed"
                      ? "bg-mintbrand text-emerald-900"
                      : appointment.status === "Completed"
                        ? "bg-slate-100 text-slate-700"
                        : "bg-blue-50 text-skybrand"
                  }`}
                >
                  {appointment.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-md border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <DollarSign aria-hidden="true" size={18} className="text-skybrand" />
              <h4 className="font-semibold">Revenue Summary</h4>
            </div>
            <div className="mt-4 h-24 rounded-md bg-slate-50 p-3">
              <div className="flex h-full items-end gap-2">
                {[42, 56, 38, 72, 64, 88].map((height, index) => (
                  <div key={height + index} className="flex-1 rounded-t bg-skybrand" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 aria-hidden="true" size={18} className="text-skybrand" />
              <h4 className="font-semibold">Recent Activity</h4>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {recentActivity.map((activity) => (
                <li key={activity} className="border-l-2 border-slate-200 pl-3">
                  {activity}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
