import {
  CalendarCheck,
  ClipboardList,
  CreditCard,
  FileText,
  HeartPulse,
  Users
} from "lucide-react";

export const features = [
  {
    title: "Client Records",
    description: "Keep contact details, treatment history, forms, and payment notes organized in one profile.",
    icon: Users
  },
  {
    title: "Appointments",
    description: "Book sessions, track statuses, and see your day without a complicated multi-provider scheduler.",
    icon: CalendarCheck
  },
  {
    title: "SOAP Notes",
    description: "Draft and complete compliant Subjective, Objective, Assessment, and Plan notes after each visit.",
    icon: ClipboardList
  },
  {
    title: "Intake Forms",
    description: "Reuse templates for new clients, consent, and health history with digital confirmation.",
    icon: FileText
  },
  {
    title: "Payments",
    description: "Use Stripe Checkout, record payment status, and keep receipt history tied to the client.",
    icon: CreditCard
  },
  {
    title: "Clinic Metrics",
    description: "Review clients, revenue, appointments, SOAP completion, and outstanding invoices at a glance.",
    icon: HeartPulse
  }
];

export const dashboardMetrics = [
  { label: "Total Clients", value: "142", change: "+12 this month" },
  { label: "Upcoming Appointments", value: "18", change: "6 confirmed today" },
  { label: "Monthly Revenue", value: "$8,420", change: "+9.4%" },
  { label: "Outstanding Invoices", value: "$740", change: "4 unpaid" },
  { label: "SOAP Notes Completed", value: "96%", change: "24 of 25 visits" }
];

export const appointments = [
  { time: "9:00 AM", client: "Maya Singh", service: "Therapeutic Massage", status: "Confirmed" },
  { time: "10:30 AM", client: "Jordan Lee", service: "Deep Tissue", status: "Pending" },
  { time: "1:00 PM", client: "Avery Chen", service: "Prenatal Massage", status: "Confirmed" },
  { time: "3:15 PM", client: "Noah Patel", service: "Follow-up Treatment", status: "Completed" }
];

export const recentActivity = [
  "SOAP note completed for Maya Singh",
  "Invoice paid by Avery Chen",
  "New intake form submitted by Noah Patel",
  "Reminder queued for Jordan Lee"
];

