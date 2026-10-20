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
};

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

export type DsSettings = { required_minutes: number; required_night_minutes: number; reminder_hours: number };
export const DEFAULT_SETTINGS: DsSettings = { required_minutes: 360, required_night_minutes: 0, reminder_hours: 24 };

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

export function requirementMet(p: Pick<StudentProgress, "minutes" | "night_minutes">, s: DsSettings): boolean {
  return Number(p.minutes) >= s.required_minutes && Number(p.night_minutes) >= s.required_night_minutes;
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
