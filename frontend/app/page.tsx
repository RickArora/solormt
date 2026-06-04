import { ButtonLink } from "@/components/button";
import { DashboardPreview } from "@/components/dashboard-preview";
import { features } from "@/lib/data";
import { Check, ShieldCheck } from "lucide-react";

const faqs = [
  {
    question: "Is SoloRMT built for Ontario RMTs?",
    answer: "Yes. The MVP is shaped around solo Canadian and Ontario massage therapy workflows."
  },
  {
    question: "Can I use it for a home clinic?",
    answer: "Yes. The dashboard, client records, SOAP notes, and payment flow are designed for solo and home clinics."
  },
  {
    question: "Does the MVP include insurance billing?",
    answer: "No. The first release focuses on clients, appointments, SOAP notes, Stripe payments, and metrics."
  }
];

export default function Home() {
  return (
    <main className="bg-white">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <a href="#" className="flex items-center gap-3 font-semibold text-ink">
            <span className="grid size-9 place-items-center rounded-md bg-skybrand text-white">S</span>
            <span>SoloRMT</span>
          </a>
          <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a className="hover:text-skybrand" href="#features">
              Features
            </a>
            <a className="hover:text-skybrand" href="#pricing">
              Pricing
            </a>
            <a className="hover:text-skybrand" href="#faq">
              FAQ
            </a>
          </div>
          <ButtonLink href="/app" className="min-h-10 px-3 py-2 text-xs sm:px-4 sm:text-sm">
            Get Started Free
          </ButtonLink>
        </nav>
      </header>

      <section className="border-b border-slate-200 bg-[#fbfdff]">
        <div className="soft-grid">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12 lg:px-8">
          <div className="flex flex-col justify-center">
            <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm sm:text-sm">
              <ShieldCheck aria-hidden="true" size={17} className="text-skybrand" />
              Built for independent massage therapists
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.04] text-ink sm:text-5xl lg:text-6xl">
              Run your practice. Not your paperwork.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Manage appointments, SOAP notes, intake forms, client records, and payments from one simple dashboard.
            </p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-row">
              <ButtonLink href="/app" className="w-full sm:w-auto">Get Started Free</ButtonLink>
              <ButtonLink href="#pricing" variant="secondary" className="w-full sm:w-auto">
                Book Demo
              </ButtonLink>
            </div>
            <div className="mt-7 grid max-w-xl gap-3 text-sm text-slate-600 sm:grid-cols-3">
              {["Ontario-ready workflow", "Stripe payments", "Mobile responsive"].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <Check aria-hidden="true" size={16} className="text-emerald-600" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            <div className="max-h-[520px] overflow-hidden rounded-lg border border-slate-200 bg-white/70 p-2 shadow-soft">
              <DashboardPreview />
            </div>
          </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-skybrand">Features</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink sm:text-3xl">Everything a solo clinic needs for the first release.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="rounded-lg border border-slate-200 bg-white p-6">
                  <Icon aria-hidden="true" size={24} className="text-skybrand" />
                  <h3 className="mt-5 text-lg font-semibold text-ink">{feature.title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-skybrand">Dashboard Preview</p>
              <h2 className="mt-3 text-2xl font-semibold text-ink sm:text-3xl">A calm operating system for your clinic day.</h2>
              <p className="mt-4 leading-7 text-slate-600">
                See appointments, revenue, recent activity, and SOAP completion without digging through separate tools.
              </p>
            </div>
            <DashboardPreview />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          {[
            "SoloRMT gives me the one-screen view I wanted for clients, payments, and notes.",
            "It feels like it was designed for a real solo massage practice, not a giant clinic.",
            "The workflow is simple enough to use between appointments."
          ].map((quote, index) => (
            <figure key={quote} className="rounded-lg border border-slate-200 bg-white p-6">
              <blockquote className="leading-7 text-slate-700">"{quote}"</blockquote>
              <figcaption className="mt-5 text-sm font-semibold text-ink">Ontario RMT #{index + 1}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="pricing" className="border-b border-slate-200 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-skybrand">Pricing</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink sm:text-3xl">Simple pricing for solo practitioners.</h2>
          </div>
          <div className="rounded-lg border-2 border-skybrand bg-white p-6 shadow-soft">
            <p className="text-sm font-semibold text-skybrand">Solo Clinic</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-semibold text-ink sm:text-5xl">$29</span>
              <span className="pb-2 text-slate-500">/ month</span>
            </div>
            <ul className="mt-6 grid gap-3 text-slate-600 sm:grid-cols-2">
              {["Unlimited clients", "Appointments", "SOAP notes", "Stripe Checkout", "Dashboard metrics", "Email support"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check aria-hidden="true" size={16} className="text-emerald-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-skybrand">FAQ</p>
          <h2 className="mt-3 text-2xl font-semibold text-ink sm:text-3xl">Questions before the first appointment.</h2>
          <div className="mt-8 divide-y divide-slate-200 rounded-lg border border-slate-200">
            {faqs.map((faq) => (
              <div key={faq.question} className="p-6">
                <h3 className="font-semibold text-ink">{faq.question}</h3>
                <p className="mt-2 leading-7 text-slate-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50 py-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 text-sm text-slate-600 sm:flex-row sm:px-6 lg:px-8">
          <span className="font-semibold text-ink">SoloRMT</span>
          <span>Built for independent massage therapists.</span>
        </div>
      </footer>
    </main>
  );
}
