// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/driving-school.ts
//
// Driving school students (2026-10-19, phase 1). A student's hours, night
// hours and miles come from the real GPS trip of each finished class
// (fn_ds_class_numbers in the database), never typed in.

export type StudentStatus = "registered" | "active" | "finished" | "dropped";

export const STUDENT_STATUSES: { value: StudentStatus; label: string }[] = [
  { value: "registered", label: "Registered" },
  { value: "active", label: "Active" },
  { value: "finished", label: "Finished" },
  { value: "dropped", label: "Dropped" },
];

export function statusLabel(s: string): string {
  return STUDENT_STATUSES.find((x) => x.value === s)?.label ?? "Active";
}

export type Student = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  status: StudentStatus;
  notes: string | null;
  branch_id: string | null;
  program_id: string | null;
  state_cert_type: string | null;
  state_cert_number: string | null;
  sms_consent_at: string | null;
  sms_consent_phone: string | null;
  preferred_language: "en" | "es" | null;
};
export const STUDENT_COLUMNS =
  "id, first_name, last_name, phone, email, guardian_name, guardian_phone, guardian_email, status, notes, branch_id, program_id, state_cert_type, state_cert_number, sms_consent_at, sms_consent_phone, preferred_language";

/** "Angel" for "Angel " -- first name plus last initial, trimmed. */
export function shortName(s: string | null | undefined): string {
  return String(s ?? "").trim();
}

export type StudentProgress = {
  student_id: string;
  classes_done: number;
  minutes: number;
  night_minutes: number;
  miles: number;
  last_class: string | null;
  next_class: string | null;
  purchased_minutes: number;
  evaluations: number;
};

// Booking rules and reminder window of a school (phase 2). The hours a
// student needs come from their program (Teen / Adult / custom).
export type DsSettings = {
  reminder_hours: number;
  booking_enabled: boolean;
  booking_lead_hours: number;
  booking_horizon_days: number;
  booking_max_upcoming: number;
  cancel_free_hours: number;
  cancellation_policy: string | null;
};
export const DEFAULT_SETTINGS: DsSettings = {
  reminder_hours: 24,
  booking_enabled: false,
  booking_lead_hours: 24,
  booking_horizon_days: 21,
  booking_max_upcoming: 2,
  cancel_free_hours: 24,
  cancellation_policy: null,
};
export const DS_SETTINGS_COLUMNS =
  "reminder_hours, booking_enabled, booking_lead_hours, booking_horizon_days, booking_max_upcoming, cancel_free_hours, cancellation_policy";

// Programs (phase 2): Teen, Adult or the school's own. Classes are for
// adults too: an Adult program has no required hours and no guardian.
export type Program = {
  id: string;
  name: string;
  required_minutes: number;
  required_night_minutes: number;
  class_minutes: number;
  notify_guardian: boolean;
  is_active: boolean;
};
export const PROGRAM_COLUMNS = "id, name, required_minutes, required_night_minutes, class_minutes, notify_guardian, is_active";
export const NO_PROGRAM: Program = {
  id: "",
  name: "No program",
  required_minutes: 0,
  required_night_minutes: 0,
  class_minutes: 60,
  notify_guardian: true,
  is_active: true,
};

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** 125 -> "2 h 05 min"; 60 -> "1 h"; 45 -> "45 min". */
export function formatMinutes(m: number | null | undefined): string {
  const total = Math.round(Number(m ?? 0));
  const h = Math.floor(total / 60);
  const min = total % 60;
  if (h === 0) return `${min} min`;
  return min === 0 ? `${h} h` : `${h} h ${String(min).padStart(2, "0")} min`;
}

/** 0..100 of a requirement (a requirement of 0 counts as met). */
export function percentOf(done: number, required: number): number {
  if (required <= 0) return 100;
  return Math.min(100, Math.round((done / required) * 100));
}

/** Hours (and night hours) of the student's program met. A program with no requirement counts once there's a class. */
export function requirementMet(p: Pick<StudentProgress, "minutes" | "night_minutes">, prog: Program): boolean {
  if (prog.required_minutes === 0 && prog.required_night_minutes === 0) return Number(p.minutes) > 0;
  return Number(p.minutes) >= prog.required_minutes && Number(p.night_minutes) >= prog.required_night_minutes;
}

export const SCORE_LABELS: Record<number, string> = {
  1: "Needs work",
  2: "Developing",
  3: "Good",
  4: "Mastered",
};

export const SCORE_CLASS: Record<number, string> = {
  1: "bg-danger/15 text-danger",
  2: "bg-warning/15 text-warning",
  3: "bg-accent/15 text-accent",
  4: "bg-success/15 text-success",
};

export function money(cents: number | null | undefined): string {
  return `$${(Number(cents ?? 0) / 100).toFixed(2)}`;
}

export function studentName(s: { first_name: string; last_name: string }): string {
  return `${s.first_name} ${s.last_name}`.trim();
}
