import Link from "next/link";
import { appointments, dashboardMetrics, recentActivity } from "@/lib/data";
import { CalendarPlus, CreditCard, FilePenLine, Search, UserPlus } from "lucide-react";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-5 lg:block">
        <Link href="/" className="flex items-center gap-3 font-semibold text-ink">
          <span className="grid size-9 place-items-center rounded-md bg-skybrand text-white">S</span>
          <span>SoloRMT</span>
        </Link>
        <nav className="mt-8 grid gap-1 text-sm font-medium text-slate-600">
          {["Dashboard", "Clients", "Appointments", "SOAP Notes", "Payments", "Settings"].map((item) => (
            <a
              key={item}
              href="#"
              className={`rounded-md px-3 py-2 ${item === "Dashboard" ? "bg-blue-50 text-skybrand" : "hover:bg-slate-50 hover:text-ink"}`}
            >
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <section className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-skybrand">Dashboard</p>
              <h1 className="truncate text-lg font-semibold text-ink sm:text-xl">Good morning, Dr. Arora</h1>
            </div>
            <label className="hidden min-w-72 items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-500 md:flex">
              <Search aria-hidden="true" size={17} />
              <input className="w-full border-0 bg-transparent outline-none" placeholder="Search clients, notes, invoices" />
            </label>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-4 pb-3 text-sm font-medium text-slate-600 sm:px-6 lg:hidden">
            {["Dashboard", "Clients", "Appointments", "Notes", "Payments"].map((item) => (
              <a
                key={item}
                href="#"
                className={`shrink-0 rounded-md border px-3 py-2 ${
                  item === "Dashboard" ? "border-skybrand bg-blue-50 text-skybrand" : "border-slate-200 bg-white"
                }`}
              >
                {item}
              </a>
            ))}
          </nav>
        </header>

        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {dashboardMetrics.map((metric) => (
              <article key={metric.label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                <p className="text-xs leading-4 text-slate-500 sm:text-sm">{metric.label}</p>
                <p className="mt-3 text-2xl font-semibold text-ink sm:text-3xl">{metric.value}</p>
                <p className="mt-2 text-xs text-slate-600 sm:text-sm">{metric.change}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Today's Schedule</h2>
                  <p className="text-sm text-slate-500">Wednesday, June 3, 2026</p>
                </div>
                <button className="focus-ring inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-skybrand px-4 text-sm font-semibold text-white hover:bg-[#168ee8] sm:w-auto">
                  <CalendarPlus aria-hidden="true" size={17} />
                  New Appointment
                </button>
              </div>
              <div className="grid gap-3 p-3 sm:hidden">
                {appointments.map((appointment) => (
                  <article key={`${appointment.time}-${appointment.client}-mobile`} className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">{appointment.time}</p>
                        <h3 className="mt-1 font-semibold text-ink">{appointment.client}</h3>
                        <p className="text-sm text-slate-600">{appointment.service}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${
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
                    <button className="focus-ring mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 text-sm font-semibold text-slate-700 hover:border-skybrand hover:text-skybrand">
                      <FilePenLine aria-hidden="true" size={16} />
                      SOAP Note
                    </button>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {appointments.map((appointment) => (
                      <tr key={`${appointment.time}-${appointment.client}`}>
                        <td className="px-4 py-4 font-medium text-slate-600">{appointment.time}</td>
                        <td className="px-4 py-4 font-semibold text-ink">{appointment.client}</td>
                        <td className="px-4 py-4 text-slate-600">{appointment.service}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-semibold ${
                              appointment.status === "Confirmed"
                                ? "bg-mintbrand text-emerald-900"
                                : appointment.status === "Completed"
                                  ? "bg-slate-100 text-slate-700"
                                  : "bg-blue-50 text-skybrand"
                            }`}
                          >
                            {appointment.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <button className="focus-ring inline-flex size-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:border-skybrand hover:text-skybrand" title="Create SOAP note">
                            <FilePenLine aria-hidden="true" size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="grid gap-6">
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-lg font-semibold text-ink">Quick Actions</h2>
                <div className="mt-4 grid gap-3">
                  {[
                    { label: "Add Client", icon: UserPlus },
                    { label: "Create SOAP Note", icon: FilePenLine },
                    { label: "Take Payment", icon: CreditCard }
                  ].map((action) => {
                    const Icon = action.icon;
                    return (
                      <button key={action.label} className="focus-ring flex min-h-11 items-center gap-3 rounded-md border border-slate-200 px-3 text-left text-sm font-semibold text-ink hover:border-skybrand hover:text-skybrand">
                        <Icon aria-hidden="true" size={18} />
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-lg font-semibold text-ink">Recent Activity</h2>
                <ul className="mt-4 space-y-3 text-sm text-slate-600">
                  {recentActivity.map((activity) => (
                    <li key={activity} className="border-l-2 border-slate-200 pl-3">
                      {activity}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
