import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CalendarTab from "@/components/calendar";
import type { Appointment, Client, Practitioner, Service } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

const appointments = [
  { id: 1, client: 1, client_name: "Cal Client", practitioner: 1, practitioner_name: "Sam Park",
    service: "Massage Therapy", date: today, time: "10:00:00", duration_minutes: 60, status: "confirmed", notes: "" },
] as unknown as Appointment[];

const clients = [{ id: 1, first_name: "Cal", last_name: "Client" }] as unknown as Client[];
const practitioners = [{ id: 1, name: "Sam Park", services: [] }] as unknown as Practitioner[];
const services = [{ id: 1, name: "Massage Therapy", duration_minutes: 60 }] as unknown as Service[];

describe("CalendarTab", () => {
  const handlers = {
    onCreate: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onSendReminder: vi.fn().mockResolvedValue({ sent: true, to: "x@test.com" }),
    setMessage: vi.fn(),
  };

  it("renders the week toolbar and a booking entry point", () => {
    render(
      <CalendarTab appointments={appointments} clients={clients} practitioners={practitioners}
        services={services} intakeResponses={[]} {...handlers} />
    );
    expect(screen.getByRole("button", { name: /today/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous week/i })).toBeInTheDocument();
  });

  it("renders an appointment block in the current week", () => {
    render(
      <CalendarTab appointments={appointments} clients={clients} practitioners={practitioners}
        services={services} intakeResponses={[]} {...handlers} />
    );
    expect(screen.getByText(/Cal Client/)).toBeInTheDocument();
  });
});
