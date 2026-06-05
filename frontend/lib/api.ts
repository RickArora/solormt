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
  practitioner: number | null;
  practitioner_name: string;
  service: string;
  date: string;
  time: string;
  duration_minutes: number;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  notes: string;
};

export type WaitlistEntry = {
  id: number;
  client: number;
  client_name: string;
  service: number;
  service_name: string;
  practitioner: number | null;
  practitioner_name: string;
  preferred_date: string | null;
  notes: string;
  status: "waiting" | "notified" | "booked" | "expired";
  notified_at: string | null;
  created_at: string;
};

export type Package = {
  id: number;
  name: string;
  description: string;
  service: number | null;
  service_name: string;
  sessions: number;
  validity_days: number;
  price_cents: number;
  price: string;
  is_active: boolean;
};

export type ClientPackage = {
  id: number;
  client: number;
  client_name: string;
  package: number | null;
  package_name: string;
  sessions_total: number;
  sessions_used: number;
  sessions_remaining: number;
  price_cents: number;
  status: "active" | "exhausted" | "expired" | "cancelled";
  purchased_at: string;
  expires_at: string | null;
};

export type InsuranceClaim = {
  id: number;
  client: number;
  client_name: string;
  appointment: number | null;
  provider: "telus" | "manual";
  claim_number: string;
  service_date: string;
  service_code: string;
  diagnosis_code: string;
  amount_submitted_cents: number;
  amount_submitted: string;
  amount_approved_cents: number;
  amount_approved: string;
  status: "draft" | "submitted" | "accepted" | "rejected" | "paid";
  response_message: string;
  submitted_at: string | null;
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
  appointment: number | null;
  kind: "invoice" | "deposit" | "card_on_file" | "full_payment";
  provider: "stripe" | "square" | "manual";
  amount_cents: number;
  amount: string;
  currency: string;
  status: "paid" | "unpaid" | "failed" | "refunded";
  checkout_url: string;
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
  requires_intake: boolean;
};

export type PractitionerAvailability = {
  id: number;
  weekday: number;
  weekday_label: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export type Practitioner = {
  id: number;
  first_name: string;
  last_name: string;
  display_name: string;
  name: string;
  email: string;
  phone: string;
  bio: string;
  services: Service[];
  availability: PractitionerAvailability[];
  is_active: boolean;
  slot_duration_minutes: number;
  buffer_minutes: number;
  slot_duration_options: number[];
};

export type IntakeResponse = {
  id: number;
  client_name: string;
  appointment: number | null;
  health_history: string;
  consent_accepted: boolean;
  status: "sent" | "completed" | "needs_review";
  answers: Record<string, unknown>;
  sent_at: string | null;
  reminder_sent_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type ReminderLog = {
  id: number;
  kind: string;
  kind_label: string;
  channel: string;
  status: string;
  scheduled_for: string;
  appointment_date: string | null;
};

export type ClientProfile = {
  client: Client & {
    insurance_company?: string;
    insurance_plan_number?: string;
    insurance_member_id?: string;
    insurance_group_number?: string;
    insurance_relationship?: string;
  };
  appointments: Appointment[];
  reminders: ReminderLog[];
  intake_responses: IntakeResponse[];
  payments: Payment[];
  soap_notes: SoapNote[];
};

export type PublicIntake = {
  clinic_name: string;
  client_first_name: string;
  status: string;
  completed: boolean;
  health_history: string;
  consent_accepted: boolean;
  appointment_date: string | null;
  appointment_time: string | null;
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
  payment_provider: "stripe" | "square";
  booking_payment_mode: "none" | "deposit" | "card_on_file" | "full_payment";
  card_on_file_required: boolean;
  reminders_enabled: boolean;
  reminder_email: string;
  sms_enabled: boolean;
  noshow_protection_enabled: boolean;
  noshow_fee_cents: number;
  services: Service[];
  practitioners: Practitioner[];
  intake_templates: Array<{ id: number; name: string; description: string; is_active: boolean }>;
  booking_url: string;
  app_url: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/proxy";

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
      const text = await response.text();
      try {
        const body = JSON.parse(text);
        message = JSON.stringify(body);
      } catch {
        message = text || message;
      }
    } catch {
      // body unreadable
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
    recaptcha_token?: string;
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
  practitioners: (token: string) => request<Practitioner[]>("/practitioners/", {}, token),
  createPractitioner: (
    token: string,
    payload: {
      first_name: string;
      last_name: string;
      display_name?: string;
      email?: string;
      phone?: string;
      bio?: string;
      service_ids?: number[];
      is_active?: boolean;
    }
  ) => request<Practitioner>("/practitioners/", { method: "POST", body: JSON.stringify(payload) }, token),
  createPractitionerAvailability: (
    token: string,
    practitionerId: number,
    payload: { weekday: number; start_time: string; end_time: string; is_active?: boolean }
  ) =>
    request<PractitionerAvailability>(`/practitioners/${practitionerId}/availability/`, {
      method: "POST",
      body: JSON.stringify(payload)
    }, token),
  intakeResponses: (token: string) => request<IntakeResponse[]>("/intake-responses/", {}, token),
  metrics: (token: string) => request<Metrics>("/dashboard/metrics/", {}, token),
  clients: (token: string) => request<Client[]>("/clients/", {}, token),
  createClient: (token: string, payload: Partial<Client>) =>
    request<Client>("/clients/", { method: "POST", body: JSON.stringify(payload) }, token),
  clientProfile: (token: string, id: number) =>
    request<ClientProfile>(`/clients/${id}/profile/`, {}, token),
  updateService: (token: string, id: number, payload: { requires_intake?: boolean; is_active?: boolean }) =>
    request<Service>(`/services/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }, token),
  // Public intake form (tokenized, no auth)
  publicIntake: (tokenValue: string) =>
    request<PublicIntake>(`/public/intake/${tokenValue}/`),
  submitPublicIntake: (tokenValue: string, payload: { health_history: string; consent_accepted: boolean }) =>
    request<{ status: string; message: string }>(`/public/intake/${tokenValue}/`, { method: "POST", body: JSON.stringify(payload) }),
  appointments: (token: string) => request<Appointment[]>("/appointments/", {}, token),
  createAppointment: (token: string, payload: Partial<Appointment>) =>
    request<Appointment>("/appointments/", { method: "POST", body: JSON.stringify(payload) }, token),
  updateAppointment: (token: string, id: number, payload: Partial<Appointment>) =>
    request<Appointment>(`/appointments/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }, token),
  deleteAppointment: (token: string, id: number) =>
    request<void>(`/appointments/${id}/`, { method: "DELETE" }, token),
  sendAppointmentReminder: (token: string, id: number) =>
    request<{ sent: boolean; channel: string; to: string }>(`/appointments/${id}/send-reminder/`, { method: "POST", body: JSON.stringify({}) }, token),
  updatePractitioner: (token: string, id: number, payload: Partial<Practitioner> & { service_ids?: number[] }) =>
    request<Practitioner>(`/practitioners/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }, token),
  practitionerAvailability: (token: string, id: number) =>
    request<PractitionerAvailability[]>(`/practitioners/${id}/availability/`, {}, token),
  deletePractitionerAvailability: (token: string, practitionerId: number, availabilityId: number) =>
    request<void>(`/practitioners/${practitionerId}/availability/${availabilityId}/`, { method: "DELETE" }, token),
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
      practitioners: Practitioner[];
      available_slots: Array<{ date: string; time: string; practitioner_id: number; practitioner_name: string }>;
      available_days: string[];
      available_times: string[];
      booked: Array<{ date: string; time: string; duration_minutes: number; status: string; practitioner_id: number | null }>;
    }>(`/public/clinics/${clinicSlug}/availability/`),
  publicAvailabilityFor: (clinicSlug: string, serviceId?: number, practitionerId?: number) => {
    const params = new URLSearchParams();
    if (serviceId) params.set("service_id", String(serviceId));
    if (practitionerId) params.set("practitioner_id", String(practitionerId));
    return request<{
      clinic: Clinic;
      practitioners: Practitioner[];
      available_slots: Array<{ date: string; time: string; practitioner_id: number; practitioner_name: string }>;
      available_days: string[];
      available_times: string[];
      booked: Array<{ date: string; time: string; duration_minutes: number; status: string; practitioner_id: number | null }>;
    }>(`/public/clinics/${clinicSlug}/availability/${params.toString() ? `?${params.toString()}` : ""}`);
  },
  publicBook: (
    clinicSlug: string,
    payload: {
      auth_mode: "register" | "login";
      service_id: number;
      practitioner_id: number;
      date: string;
      time: string;
      first_name: string;
      last_name: string;
      email: string;
      password: string;
      phone: string;
      health_history: string;
      consent_accepted: boolean;
      pay_deposit: boolean;
      save_card: boolean;
      recaptcha_token?: string;
    }
  ) =>
    request<{
      appointment_id: number;
      client_id: number;
      intake_id: number;
      payment_id: number | null;
      payment_required: boolean;
      checkout_url: string;
      client_access: string;
      client_refresh: string;
      status: string;
      message: string;
    }>(
      `/public/clinics/${clinicSlug}/book/`,
      { method: "POST", body: JSON.stringify(payload) }
    ),
  clientPortalAuth: (
    clinicSlug: string,
    payload: {
      mode: "register" | "login";
      email: string;
      password: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
      recaptcha_token?: string;
    }
  ) =>
    request<{ access: string; refresh: string; client_id: number; clinic: Clinic }>(
      `/public/clinics/${clinicSlug}/portal/auth/`,
      { method: "POST", body: JSON.stringify(payload) }
    ),
  clientPortal: (clinicSlug: string, token: string) =>
    request<{
      clinic: Clinic;
      client: { id: number; name: string; email: string; phone: string };
      appointments: Appointment[];
      intake_responses: IntakeResponse[];
      payments: Payment[];
    }>(`/client/clinics/${clinicSlug}/portal/`, {}, token),
  clientAppointmentAction: (
    clinicSlug: string,
    appointmentId: number,
    action: "cancel" | "reschedule",
    token: string,
    payload: { date?: string; time?: string } = {}
  ) =>
    request<Appointment>(
      `/client/clinics/${clinicSlug}/appointments/${appointmentId}/${action}/`,
      { method: "POST", body: JSON.stringify(payload) },
      token
    ),
  // Waitlist
  waitlist: (token: string) => request<WaitlistEntry[]>("/waitlist/", {}, token),
  createWaitlistEntry: (token: string, payload: Partial<WaitlistEntry>) =>
    request<WaitlistEntry>("/waitlist/", { method: "POST", body: JSON.stringify(payload) }, token),
  updateWaitlistEntry: (token: string, id: number, payload: Partial<WaitlistEntry>) =>
    request<WaitlistEntry>(`/waitlist/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }, token),
  deleteWaitlistEntry: (token: string, id: number) =>
    request<void>(`/waitlist/${id}/`, { method: "DELETE" }, token),
  // No-show
  markNoShow: (token: string, appointmentId: number) =>
    request<{ appointment: Appointment; no_show_fee_created: boolean; fee_cents: number }>(
      `/appointments/${appointmentId}/no-show/`, { method: "POST", body: JSON.stringify({}) }, token
    ),
  // Packages
  packages: (token: string) => request<Package[]>("/packages/", {}, token),
  createPackage: (token: string, payload: Partial<Package>) =>
    request<Package>("/packages/", { method: "POST", body: JSON.stringify(payload) }, token),
  clientPackages: (token: string) => request<ClientPackage[]>("/client-packages/", {}, token),
  purchasePackage: (token: string, payload: { package_id: number; client_id: number }) =>
    request<ClientPackage>("/client-packages/", { method: "POST", body: JSON.stringify(payload) }, token),
  redeemPackageSession: (token: string, clientPackageId: number) =>
    request<ClientPackage>(`/client-packages/${clientPackageId}/redeem/`, { method: "POST", body: JSON.stringify({}) }, token),
  // Insurance / TELUS eClaims
  insuranceClaims: (token: string) => request<InsuranceClaim[]>("/insurance-claims/", {}, token),
  createInsuranceClaim: (token: string, payload: Partial<InsuranceClaim>) =>
    request<InsuranceClaim>("/insurance-claims/", { method: "POST", body: JSON.stringify(payload) }, token),
  submitInsuranceClaim: (token: string, claimId: number) =>
    request<InsuranceClaim>(`/insurance-claims/${claimId}/submit/`, { method: "POST", body: JSON.stringify({}) }, token),
};
