export type Client = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string | null;
  emergency_contact: string;
  notes: string;
};

export type Appointment = {
  id: number;
  client: number;
  client_name: string;
  service: string;
  date: string;
  time: string;
  duration_minutes: number;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  notes: string;
};

export type SoapNote = {
  id: number;
  client: number;
  client_name: string;
  appointment: number | null;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  is_complete: boolean;
};

export type Payment = {
  id: number;
  client: number;
  client_name: string;
  amount_cents: number;
  amount: string;
  currency: string;
  status: "paid" | "unpaid" | "failed" | "refunded";
};

export type Metrics = {
  total_clients: number;
  upcoming_appointments: number;
  appointments_by_status: Record<string, number>;
  monthly_revenue_cents: number;
  outstanding_invoices_cents: number;
  soap_notes_completed: number;
  soap_completion_rate: number;
};

export type Service = {
  id: number;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  price: string;
  is_active: boolean;
};

export type IntakeResponse = {
  id: number;
  client_name: string;
  appointment: number | null;
  health_history: string;
  consent_accepted: boolean;
  answers: Record<string, unknown>;
  created_at: string;
};

export type Clinic = {
  id: number;
  name: string;
  slug: string;
  public_email: string;
  public_phone: string;
  address: string;
  booking_policy: string;
  cancellation_window_hours: number;
  deposit_required: boolean;
  deposit_amount_cents: number;
  reminders_enabled: boolean;
  services: Service[];
  intake_templates: Array<{ id: number; name: string; description: string; is_active: boolean }>;
  booking_url: string;
  app_url: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const body = await response.json();
      message = JSON.stringify(body);
    } catch {
      message = await response.text();
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access: string; refresh: string }>("/auth/token/", {
      method: "POST",
      body: JSON.stringify({ username: email, password })
    }),
  register: (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    clinic_name: string;
  }) =>
    request<{ access: string; refresh: string }>("/auth/register/", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  me: (token: string) => request<{ email: string; clinic_name: string; role: string }>("/auth/me/", {}, token),
  clinic: (token: string) => request<Clinic>("/clinic/", {}, token),
  updateClinic: (token: string, payload: Partial<Clinic>) =>
    request<Clinic>("/clinic/", { method: "PATCH", body: JSON.stringify(payload) }, token),
  services: (token: string) => request<Service[]>("/services/", {}, token),
  intakeResponses: (token: string) => request<IntakeResponse[]>("/intake-responses/", {}, token),
  metrics: (token: string) => request<Metrics>("/dashboard/metrics/", {}, token),
  clients: (token: string) => request<Client[]>("/clients/", {}, token),
  createClient: (token: string, payload: Partial<Client>) =>
    request<Client>("/clients/", { method: "POST", body: JSON.stringify(payload) }, token),
  appointments: (token: string) => request<Appointment[]>("/appointments/", {}, token),
  createAppointment: (token: string, payload: Partial<Appointment>) =>
    request<Appointment>("/appointments/", { method: "POST", body: JSON.stringify(payload) }, token),
  soapNotes: (token: string) => request<SoapNote[]>("/soap-notes/", {}, token),
  createSoapNote: (token: string, payload: Partial<SoapNote>) =>
    request<SoapNote>("/soap-notes/", { method: "POST", body: JSON.stringify(payload) }, token),
  payments: (token: string) => request<Payment[]>("/payments/", {}, token),
  createPayment: (token: string, payload: Partial<Payment>) =>
    request<Payment>("/payments/", { method: "POST", body: JSON.stringify(payload) }, token),
  publicClinic: (clinicSlug: string) => request<Clinic>(`/public/clinics/${clinicSlug}/`),
  publicAvailability: (clinicSlug: string) =>
    request<{
      clinic: Clinic;
      available_days: string[];
      available_times: string[];
      booked: Array<{ date: string; time: string; duration_minutes: number; status: string }>;
    }>(`/public/clinics/${clinicSlug}/availability/`),
  publicBook: (
    clinicSlug: string,
    payload: {
      service_id: number;
      date: string;
      time: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      health_history: string;
      consent_accepted: boolean;
      pay_deposit: boolean;
    }
  ) =>
    request<{ appointment_id: number; client_id: number; intake_id: number; payment_id: number | null; status: string; message: string }>(
      `/public/clinics/${clinicSlug}/book/`,
      { method: "POST", body: JSON.stringify(payload) }
    )
};
