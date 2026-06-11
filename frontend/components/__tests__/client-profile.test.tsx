import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ClientProfilePanel from "@/components/client-profile";
import type { ClientProfile } from "@/lib/api";

const profile = {
  client: {
    id: 1, first_name: "Jane", last_name: "Smith", email: "jane@test.com", phone: "416-555-0100",
    date_of_birth: null, emergency_contact: "", notes: "", sms_opt_in: true,
  },
  appointments: [
    { id: 1, client: 1, client_name: "Jane Smith", practitioner: 1, practitioner_name: "Sam Park",
      service: "Massage Therapy", date: "2026-07-01", time: "10:00:00", duration_minutes: 60, status: "confirmed", notes: "" },
  ],
  reminders: [
    { id: 1, kind: "confirmation", kind_label: "Confirmation", channel: "email", status: "sent",
      scheduled_for: "2026-06-20T12:00:00Z", appointment_date: "2026-07-01" },
  ],
  intake_responses: [
    { id: 1, client_name: "Jane Smith", appointment: 1, health_history: "", consent_accepted: true,
      status: "completed", answers: {}, sent_at: "2026-06-18T10:00:00Z", reminder_sent_at: null,
      completed_at: "2026-06-19T10:00:00Z", created_at: "2026-06-18T10:00:00Z" },
  ],
  payments: [
    { id: 1, client: 1, client_name: "Jane Smith", appointment: null, kind: "invoice", provider: "manual",
      amount_cents: 12000, amount: "120.00", currency: "CAD", status: "paid", checkout_url: "" },
  ],
  soap_notes: [],
} as unknown as ClientProfile;

describe("ClientProfilePanel", () => {
  it("shows a loading state before data arrives", () => {
    render(<ClientProfilePanel profile={null} loading onClose={vi.fn()} />);
    expect(screen.getByText(/Loading profile/i)).toBeInTheDocument();
  });

  it("renders the Jane-style communication log", () => {
    render(<ClientProfilePanel profile={profile} loading={false} onClose={vi.fn()} />);
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText(/Clinic Forms/i)).toBeInTheDocument();
    expect(screen.getByText(/Reminders Sent/i)).toBeInTheDocument();
    // intake completed -> shows "Filled out", reminder -> its label, sms -> opted in
    expect(screen.getByText(/Filled out/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmation/i)).toBeInTheDocument();
    expect(screen.getByText(/opted in/i)).toBeInTheDocument();
  });
});
