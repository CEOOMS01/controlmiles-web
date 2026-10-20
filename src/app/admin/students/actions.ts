"use server";

// Olympus Mont Systems LLC - ControlMiles Web
// src/app/admin/students/actions.ts
//
// Driving school students (2026-10-19). Every write goes through RLS and
// the plan features (students / student_packages / student_portal /
// student_certificates / student_evaluations) in the database; these
// actions only shape the input.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { AppError } from "@/lib/errors";

export type ActionState = { error: string | null; success: boolean; value?: string };

const text = (fd: FormData, k: string, max = 200) => {
  const v = String(fd.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function orgId(): Promise<string | null> {
  const { profile } = await getAuthedProfile();
  return profile?.default_org_id ?? null;
}

function studentFields(fd: FormData) {
  return {
    first_name: text(fd, "first_name", 60),
    last_name: text(fd, "last_name", 60),
    phone: text(fd, "phone", 30),
    email: text(fd, "email", 120)?.toLowerCase() ?? null,
    guardian_name: text(fd, "guardian_name", 120),
    guardian_phone: text(fd, "guardian_phone", 30),
    guardian_email: text(fd, "guardian_email", 120)?.toLowerCase() ?? null,
    status: (text(fd, "status", 20) ?? "active") as string,
    notes: text(fd, "notes", 1000),
    branch_id: text(fd, "branch_id", 40),
    program_id: text(fd, "program_id", 40),
    ...(fd.has("has_state_records")
      ? { state_cert_type: text(fd, "state_cert_type", 40), state_cert_number: text(fd, "state_cert_number", 40) }
      : {}),
    ...smsConsent(fd),
  };
}

// SMS consent recorded by the office (phase 2): the student (or guardian)
// agreed to text reminders. Sent once a Twilio account is connected.
function smsConsent(fd: FormData) {
  if (!fd.has("has_sms")) return {};
  if (fd.get("sms_consent") !== "on") {
    return { sms_consent_at: null, sms_consent_phone: null, sms_consent_source: null };
  }
  const phone = (text(fd, "sms_consent_phone", 30) ?? "").replace(/[^0-9+]/g, "");
  return {
    sms_consent_at: String(fd.get("sms_consent_was") ?? "") || new Date().toISOString(),
    sms_consent_phone: phone || null,
    sms_consent_source: "office",
  };
}

function checkStudent(f: ReturnType<typeof studentFields>): string | null {
  if (!f.first_name || !f.last_name) return "Enter the student's first and last name.";
  if (f.email && !EMAIL.test(f.email)) return "The student's email doesn't look right.";
  if (f.guardian_email && !EMAIL.test(f.guardian_email)) return "The guardian's email doesn't look right.";
  if (!["registered", "active", "finished", "dropped"].includes(f.status)) return "Pick a status.";
  if ("sms_consent_at" in f && f.sms_consent_at && (!f.sms_consent_phone || f.sms_consent_phone.length < 10)) {
    return "Enter the mobile number that agreed to text reminders.";
  }
  return null;
}

async function savePrivate(studentId: string, org: string, fd: FormData): Promise<string | null> {
  if (!fd.has("has_private")) return null;
  const dob = text(fd, "date_of_birth", 10);
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return "Enter a valid date of birth.";
  const supabase = await createClient();
  const { error } = await supabase.from("ds_student_private").upsert(
    { student_id: studentId, organization_id: org, date_of_birth: dob, permit_number: text(fd, "permit_number", 40) },
    { onConflict: "student_id" },
  );
  return error ? AppError.from(error).display() : null;
}

export async function createStudent(_p: ActionState, fd: FormData): Promise<ActionState> {
  const org = await orgId();
  if (!org) return { error: "No fleet.", success: false };
  const f = studentFields(fd);
  const bad = checkStudent(f);
  if (bad) return { error: bad, success: false };
  const supabase = await createClient();
  const { user } = await getAuthedProfile();
  const { data, error } = await supabase
    .from("ds_students")
    .insert({ ...f, organization_id: org, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error || !data) return { error: AppError.from(error).display(), success: false };
  const privErr = await savePrivate(data.id, org, fd);
  if (privErr) return { error: privErr, success: false };
  revalidatePath("/admin/students");
  return { error: null, success: true, value: data.id };
}

export async function updateStudent(_p: ActionState, fd: FormData): Promise<ActionState> {
  const org = await orgId();
  const id = text(fd, "id", 40);
  if (!org || !id) return { error: "Invalid student.", success: false };
  const f = studentFields(fd);
  const bad = checkStudent(f);
  if (bad) return { error: bad, success: false };
  const supabase = await createClient();
  const { error } = await supabase.from("ds_students").update(f).eq("id", id).eq("organization_id", org);
  if (error) return { error: AppError.from(error).display(), success: false };
  const privErr = await savePrivate(id, org, fd);
  if (privErr) return { error: privErr, success: false };
  revalidatePath(`/admin/students/${id}`);
  revalidatePath("/admin/students");
  return { error: null, success: true };
}

// ---------------- packages ----------------
export async function addStudentPackage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const org = await orgId();
  const studentId = text(fd, "student_id", 40);
  const packageId = text(fd, "package_id", 40);
  if (!org || !studentId || !packageId) return { error: "Pick a package.", success: false };
  const supabase = await createClient();
  const { data: pkg } = await supabase
    .from("ds_packages")
    .select("id, name, minutes, price_cents")
    .eq("id", packageId)
    .eq("organization_id", org)
    .maybeSingle();
  if (!pkg) return { error: "Package not found.", success: false };
  const paid = Math.max(0, Math.round(Number(text(fd, "amount_paid", 12) ?? "0") * 100) || 0);
  const status = paid <= 0 ? "pending" : paid >= pkg.price_cents ? "paid" : "partial";
  const { error } = await supabase.from("ds_student_packages").insert({
    organization_id: org,
    student_id: studentId,
    package_id: pkg.id,
    name: pkg.name,
    minutes: pkg.minutes,
    price_cents: pkg.price_cents,
    amount_paid_cents: paid,
    payment_status: status,
    note: text(fd, "note", 500),
  });
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath(`/admin/students/${studentId}`);
  return { error: null, success: true };
}

export async function recordPayment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const id = text(fd, "id", 40);
  const studentId = text(fd, "student_id", 40);
  if (!id || !studentId) return { error: "Invalid package.", success: false };
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("ds_student_packages")
    .select("price_cents, amount_paid_cents")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "Package not found.", success: false };
  const add = Math.round(Number(text(fd, "amount", 12) ?? "0") * 100) || 0;
  if (add <= 0) return { error: "Enter the amount received.", success: false };
  const paid = row.amount_paid_cents + add;
  const status = paid >= row.price_cents ? "paid" : "partial";
  const { error } = await supabase
    .from("ds_student_packages")
    .update({ amount_paid_cents: paid, payment_status: status })
    .eq("id", id);
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath(`/admin/students/${studentId}`);
  return { error: null, success: true };
}

// ---------------- portal link ----------------
export async function createPortalLink(studentId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ds_create_portal_link", { p_student: studentId });
  if (error || !data) return { error: AppError.from(error).display(), success: false };
  revalidatePath(`/admin/students/${studentId}`);
  return { error: null, success: true, value: String(data) };
}

export async function revokePortalLink(studentId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ds_revoke_portal_link", { p_student: studentId });
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath(`/admin/students/${studentId}`);
  return { error: null, success: true };
}

// ---------------- certificate ----------------
export async function issueCertificate(studentId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ds_issue_certificate", { p_student: studentId });
  if (error || !data) {
    const msg = String(error?.message ?? "");
    if (msg.includes("REQUIRED_HOURS_NOT_MET")) {
      return { error: "The student hasn't reached the required hours yet.", success: false };
    }
    return { error: AppError.from(error).display(), success: false };
  }
  revalidatePath(`/admin/students/${studentId}`);
  return { error: null, success: true, value: String(data) };
}

// ---------------- settings, skills, package catalog ----------------
export async function saveDsSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  const org = await orgId();
  if (!org) return { error: "No fleet.", success: false };
  const num = (k: string, def: number) => {
    const v = Number(text(fd, k, 8) ?? def);
    return Number.isFinite(v) ? Math.round(v) : def;
  };
  const row = {
    organization_id: org,
    reminder_hours: num("reminder_hours", 24),
    booking_enabled: fd.get("booking_enabled") === "on",
    booking_lead_hours: num("booking_lead_hours", 24),
    booking_horizon_days: num("booking_horizon_days", 21),
    booking_max_upcoming: num("booking_max_upcoming", 2),
    cancel_free_hours: num("cancel_free_hours", 24),
    cancellation_policy: text(fd, "cancellation_policy", 1000),
    updated_at: new Date().toISOString(),
  };
  if (row.reminder_hours < 1 || row.reminder_hours > 168) return { error: "Reminder: 1 to 168 hours before.", success: false };
  if (row.booking_lead_hours < 0 || row.booking_lead_hours > 336) return { error: "Minimum notice: 0 to 336 hours.", success: false };
  if (row.booking_horizon_days < 1 || row.booking_horizon_days > 90) return { error: "Booking window: 1 to 90 days.", success: false };
  if (row.booking_max_upcoming < 1 || row.booking_max_upcoming > 20) return { error: "Upcoming classes: 1 to 20.", success: false };
  if (row.cancel_free_hours < 0 || row.cancel_free_hours > 336) return { error: "Free cancellation: 0 to 336 hours.", success: false };
  const supabase = await createClient();
  const { error } = await supabase.from("ds_settings").upsert(row, { onConflict: "organization_id" });
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/students", "layout");
  return { error: null, success: true };
}

// ---------------- programs ----------------
export async function saveProgram(_p: ActionState, fd: FormData): Promise<ActionState> {
  const org = await orgId();
  const id = text(fd, "id", 40);
  const name = text(fd, "name", 60);
  const hours = Number(text(fd, "required_hours", 8) ?? "0");
  const night = Number(text(fd, "required_night_hours", 8) ?? "0");
  const length = Number(text(fd, "class_minutes", 4) ?? "60");
  if (!org || !name) return { error: "Name the program.", success: false };
  if (!(hours >= 0 && hours <= 1000) || !(night >= 0 && night <= hours)) {
    return { error: "Night hours can't be more than the required hours.", success: false };
  }
  if (!(length >= 15 && length <= 480)) return { error: "Class length: 15 to 480 minutes.", success: false };
  const row = {
    organization_id: org,
    name,
    required_minutes: Math.round(hours * 60),
    required_night_minutes: Math.round(night * 60),
    class_minutes: Math.round(length),
    notify_guardian: fd.get("notify_guardian") === "on",
    is_active: fd.has("has_active") ? fd.get("is_active") === "on" : true,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("ds_programs").update(row).eq("id", id).eq("organization_id", org)
    : await supabase.from("ds_programs").insert({ ...row, sort: 100 });
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/students", "layout");
  return { error: null, success: true };
}

// ---------------- availability and time off ----------------
export async function addAvailability(_p: ActionState, fd: FormData): Promise<ActionState> {
  const org = await orgId();
  const instructor = text(fd, "instructor_id", 40);
  const days = fd
    .getAll("weekday")
    .map((d) => Number(d))
    .filter((d) => d >= 0 && d <= 6);
  const start = text(fd, "start_time", 8);
  const end = text(fd, "end_time", 8);
  const vehicle = text(fd, "vehicle_id", 40);
  if (!org || !instructor) return { error: "Pick an instructor.", success: false };
  if (days.length === 0) return { error: "Pick at least one day.", success: false };
  if (!start || !end || end <= start) return { error: "The hours must end after they start.", success: false };
  const supabase = await createClient();
  const { error } = await supabase.from("ds_availability").insert(
    days.map((weekday) => ({
      organization_id: org,
      instructor_id: instructor,
      weekday,
      start_time: start,
      end_time: end,
      vehicle_id: vehicle,
    })),
  );
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/shifts");
  return { error: null, success: true };
}

export async function removeAvailability(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("ds_availability").delete().eq("id", id);
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/shifts");
  return { error: null, success: true };
}

export async function addTimeOff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const org = await orgId();
  const instructor = text(fd, "instructor_id", 40);
  const from = text(fd, "date_from", 10);
  const to = text(fd, "date_to", 10) ?? from;
  if (!org || !instructor) return { error: "Pick an instructor.", success: false };
  if (!from || !to || to < from) return { error: "Pick the days off.", success: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("ds_time_off")
    .insert({ organization_id: org, instructor_id: instructor, date_from: from, date_to: to, note: text(fd, "note", 200) });
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/shifts");
  return { error: null, success: true };
}

export async function removeTimeOff(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("ds_time_off").delete().eq("id", id);
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/shifts");
  return { error: null, success: true };
}

export async function addSkill(_p: ActionState, fd: FormData): Promise<ActionState> {
  const org = await orgId();
  const category = text(fd, "category", 60);
  const name = text(fd, "name", 80);
  if (!org || !category || !name) return { error: "Enter a category and a skill.", success: false };
  const supabase = await createClient();
  const { error } = await supabase.from("ds_skills").insert({ organization_id: org, category, name, sort: 1000 });
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/students/settings");
  return { error: null, success: true };
}

export async function setSkillActive(id: string, active: boolean): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("ds_skills").update({ is_active: active }).eq("id", id);
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/students/settings");
  return { error: null, success: true };
}

export async function addPackage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const org = await orgId();
  const name = text(fd, "name", 80);
  const hours = Number(text(fd, "hours", 8) ?? "0");
  const price = Number(text(fd, "price", 12) ?? "0");
  if (!org || !name) return { error: "Name the package.", success: false };
  if (!(hours > 0 && hours <= 1000)) return { error: "Enter the hours it includes.", success: false };
  if (!(price >= 0)) return { error: "Enter a price.", success: false };
  const supabase = await createClient();
  const { error } = await supabase.from("ds_packages").insert({
    organization_id: org,
    name,
    minutes: Math.round(hours * 60),
    price_cents: Math.round(price * 100),
  });
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/students/settings");
  return { error: null, success: true };
}

export async function setPackageActive(id: string, active: boolean): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("ds_packages").update({ is_active: active }).eq("id", id);
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/students/settings");
  return { error: null, success: true };
}

// Website integration (2026-10-20, Enterprise): the school's public
// enrollment page and the sites allowed to embed it.
export async function savePublicPage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const org = await orgId();
  if (!org) return { error: "Missing organization.", success: false };
  const slug = (text(fd, "slug", 40) ?? "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) {
    return { error: "The page address uses 3 to 40 lowercase letters, numbers and dashes.", success: false };
  }
  const origins: string[] = [];
  for (const line of String(fd.get("allowed_origins") ?? "").split(/[\s,]+/)) {
    const raw = line.trim();
    if (!raw) continue;
    let url: URL;
    try {
      url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    } catch {
      return { error: `“${raw}” isn't a website address.`, success: false };
    }
    if (url.protocol !== "https:") return { error: `“${raw}” must use https.`, success: false };
    if (!origins.includes(url.origin)) origins.push(url.origin);
  }
  if (origins.length > 5) return { error: "List up to 5 websites.", success: false };
  const terms = text(fd, "terms_url", 300);
  if (terms && !/^https:\/\//.test(terms)) return { error: "The terms link must start with https://", success: false };
  const minAge = Number(text(fd, "min_age", 3) ?? 15);
  if (!Number.isInteger(minAge) || minAge < 13 || minAge > 25) {
    return { error: "Minimum age must be between 13 and 25.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("ds_public_pages").upsert({
    organization_id: org,
    slug,
    enabled: fd.get("enabled") === "on",
    intro: text(fd, "intro", 600),
    min_age: minAge,
    terms_url: terms,
    allowed_origins: origins,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505") return { error: "That page address is taken. Try another.", success: false };
    return { error: AppError.from(error).display(), success: false };
  }
  revalidatePath("/admin/students/settings");
  return { error: null, success: true };
}

export async function approveEnrollment(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ds_enrollment_approve", { p_id: id });
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/students");
  return { error: null, success: true, value: String(data ?? "") };
}

export async function declineEnrollment(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ds_enrollment_decline", { p_id: id });
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/students");
  return { error: null, success: true };
}

/** Undo an approval (while the student has nothing yet) or a decline. */
export async function undoEnrollment(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ds_enrollment_undo", { p_id: id });
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/students");
  return { error: null, success: true };
}
