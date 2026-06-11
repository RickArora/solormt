import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const publicIntake = vi.fn();
const submitPublicIntake = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    publicIntake: (...args: unknown[]) => publicIntake(...args),
    submitPublicIntake: (...args: unknown[]) => submitPublicIntake(...args),
  },
}));

import IntakeClient from "./intake-client";

const base = {
  clinic_name: "Test Clinic",
  client_first_name: "Jane",
  consent_accepted: false,
  health_history: "",
  appointment_date: null,
  appointment_time: null,
};

describe("IntakeClient", () => {
  beforeEach(() => {
    publicIntake.mockReset();
    submitPublicIntake.mockReset();
  });

  it("renders the form for an editable intake", async () => {
    publicIntake.mockResolvedValue({ ...base, status: "sent", completed: false, expired: false, editable: true });
    render(<IntakeClient token="abc" />);
    await waitFor(() => expect(screen.getByText(/Intake & Consent/i)).toBeInTheDocument());
    expect(screen.getByText(/Health history/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit intake form/i })).toBeInTheDocument();
  });

  it("shows the completed state", async () => {
    publicIntake.mockResolvedValue({ ...base, status: "completed", completed: true, expired: false, editable: false });
    render(<IntakeClient token="abc" />);
    await waitFor(() => expect(screen.getByText(/Intake form complete/i)).toBeInTheDocument());
  });

  it("shows the expired state for a stale link", async () => {
    publicIntake.mockResolvedValue({ ...base, status: "sent", completed: false, expired: true, editable: false });
    render(<IntakeClient token="abc" />);
    await waitFor(() => expect(screen.getByText(/intake link has expired/i)).toBeInTheDocument());
  });
});
