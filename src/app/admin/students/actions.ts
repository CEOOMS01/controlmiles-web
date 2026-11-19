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
import { checkCustomDomain, removeCustomDomain } from "@/lib/custom-domain";

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
    // Pickup address: the instructor sees it on the class and navigates to it from the app.
    address_line: text(fd, "address_line", 160),
    city: text(fd, "city", 80),
    state: text(fd, "state", 40),
    postal_code: text(fd, "postal_code", 12),
    guardian_name: text(fd, "guardian_name", 120),
    guardian_phone: text(fd, "guardian_phone", 30),
    guardian_email: text(fd, "guardian_email", 120)?.toLowerCase() ?? null,
    status: (text(fd, "status", 20) ?? "active") as string,
    notes: text(fd, "notes", 1000),
    branch_id: text(fd, "branch_id", 40),
    program_id: text(fd, "program_id", 40),
    // Lesson language preference (2026-10-20): English, Spanish or none.
    preferred_language: ["en", "es"].includes(String(fd.get("preferred_language"))) ? String(fd.get("preferred_language")) : null,
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
  const add = Math.round(Number(text(fd, "amount", 12) ?? "0") * 100) || 0;
  if (add <= 0) return { error: "Enter the amount received.", success: false };
  // One locked step in the database (ds_record_payment): two payments at the
  // same moment cannot overwrite each other, and one larger than the balance
  // due is refused.
  const supabase = await createClient();
  const { error } = await supabase.rpc("ds_record_payment", { p_package: id, p_amount_cents: add });
  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("PAYMENT_EXCEEDS_BALANCE")) return { error: "That is more than the balance due.", success: false };
    if (msg.includes("PACKAGE_NOT_FOUND")) return { error: "Package not found.", success: false };
    return { error: AppError.from(error).display(), success: false };
  }
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
    booking_open_time: text(fd, "booking_open_time", 8) || null,
    booking_close_time: text(fd, "booking_close_time", 8) || null,
    booking_max_upcoming: num("booking_max_upcoming", 2),
    cancel_free_hours: num("cancel_free_hours", 24),
    cancellation_policy: text(fd, "cancellation_policy", 1000),
    updated_at: new Date().toISOString(),
  };
  if (row.reminder_hours < 1 || row.reminder_hours > 168) return { error: "Reminder: 1 to 168 hours before.", success: false };
  if (row.booking_lead_hours < 0 || row.booking_lead_hours > 336) return { error: "Minimum notice: 0 to 336 hours.", success: false };
  if (row.booking_horizon_days < 1 || row.booking_horizon_days > 365) return { error: "Booking window: 1 to 365 days.", success: false };
  if (!row.booking_open_time !== !row.booking_close_time) return { error: "Set both the opening and closing hour, or leave both empty.", success: false };
  if (row.booking_open_time && row.booking_close_time && row.booking_close_time <= row.booking_open_time)
    return { error: "The closing hour must be after the opening hour.", success: false };
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

// ---------------- services (what the school sells) and how the school gets paid ----------------
// 2026-11-18: ControlMiles never takes the student's payment; the school lists its services with prices
// and says how it collects (at the school, or its own payment link). See the plan, phase 1.
export async function addService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const org = await orgId();
  const name = text(fd, "name", 80);
  const price = Number(text(fd, "price", 10) ?? "0");
  const hours = Number(text(fd, "hours", 8) ?? "0");
  const kind = ["lesson", "group_class", "product"].includes(String(fd.get("kind"))) ? String(fd.get("kind")) : "product";
  if (!org || !name) return { error: "Enter the service name.", success: false };
  if (!(price >= 0 && price <= 100000)) return { error: "Enter a price.", success: false };
  if (!(hours >= 0 && hours <= 1000)) return { error: "Hours: 0 to 1000.", success: false };
  const supabase = await createClient();
  const { error } = await supabase.from("ds_services").insert({
    organization_id: org,
    name,
    description: text(fd, "description", 300),
    kind,
    price_cents: Math.round(price * 100),
    minutes: hours > 0 ? Math.round(hours * 60) : null,
    branch_id: text(fd, "branch_id", 40),
  });
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/students/settings");
  return { error: null, success: true };
}

export async function setServiceActive(id: string, active: boolean): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("ds_services").update({ is_active: active }).eq("id", id);
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/students/settings");
  return { error: null, success: true };
}

export async function savePaymentSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  const org = await orgId();
  if (!org) return { error: "No fleet.", success: false };
  const asked = String(fd.get("payment_mode") ?? "");
  const mode = asked === "link" ? "link" : asked === "banquest" ? "banquest" : "at_school";
  const link = text(fd, "payment_link", 300);
  if (mode === "link" && !(link && /^https:\/\/[^\s]+$/.test(link))) {
    return { error: "Enter your payment page address, starting with https://", success: false };
  }
  const supabase = await createClient();
  if (mode === "banquest") {
    const { data: connected } = await supabase.from("ds_payment_providers").select("status").eq("organization_id", org).maybeSingle();
    if (!connected) return { error: "Connect your Banquest account first.", success: false };
  }
  // Only the payment columns: the rest of the settings stay as they are (the row is created if it is missing).
  const { error } = await supabase.from("ds_settings").upsert(
    {
      organization_id: org,
      payment_mode: mode,
      payment_link: mode === "link" ? link : null,
      payment_instructions: text(fd, "payment_instructions", 500),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/students", "layout");
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
  const values = {
    slug,
    enabled: fd.get("enabled") === "on",
    intro: text(fd, "intro", 600),
    min_age: minAge,
    terms_url: terms,
    allowed_origins: origins,
    updated_at: new Date().toISOString(),
  };
  // Update, else insert: the office may write only these columns (the
  // address columns go through ds_set_custom_domain), so no upsert.
  const updated = await supabase.from("ds_public_pages").update(values).eq("organization_id", org).select("organization_id");
  const { error } =
    updated.error || (updated.data ?? []).length > 0
      ? updated
      : await supabase.from("ds_public_pages").insert({ organization_id: org, ...values });
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

// Level 3 (2026-10-20): the school's own address for its enrollment page.
export async function setCustomDomain(_p: ActionState, fd: FormData): Promise<ActionState> {
  const org = await orgId();
  if (!org) return { error: "Missing organization.", success: false };
  const raw = (text(fd, "custom_domain", 253) ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const supabase = await createClient();
  const { data: prev } = await supabase.from("ds_public_pages").select("custom_domain").eq("organization_id", org).maybeSingle();
  const { error } = await supabase.rpc("ds_set_custom_domain", { p_org: org, p_domain: raw });
  if (error) return { error: AppError.from(error).display(), success: false };
  if (prev?.custom_domain && prev.custom_domain !== raw) await removeCustomDomain(prev.custom_domain);
  revalidatePath("/admin/students/settings");
  return { error: null, success: true };
}

export async function verifyCustomDomain(): Promise<ActionState> {
  const org = await orgId();
  if (!org) return { error: "Missing organization.", success: false };
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("ds_public_pages")
    .select("custom_domain, domain_token")
    .eq("organization_id", org)
    .maybeSingle();
  if (!page?.custom_domain || !page.domain_token) return { error: "Add an address first.", success: false };
  const result = await checkCustomDomain(page.custom_domain, page.domain_token);
  const { error } = await supabase.rpc("ds_mark_custom_domain", { p_org: org, p_status: result.status, p_message: result.message });
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/students/settings");
  return { error: null, success: result.status === "verified", value: result.message };
}

export async function clearCustomDomain(): Promise<ActionState> {
  const org = await orgId();
  if (!org) return { error: "Missing organization.", success: false };
  const supabase = await createClient();
  const { data: old, error } = await supabase.rpc("ds_clear_custom_domain", { p_org: org });
  if (error) return { error: AppError.from(error).display(), success: false };
  if (old) await removeCustomDomain(String(old));
  revalidatePath("/admin/students/settings");
  return { error: null, success: true };
}

// A client's order from the school's portal: the school marks it paid (or cancels it).
export async function setOrderStatus(id: string, status: "paid" | "cancelled" | "pending_payment"): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ds_service_orders")
    .update({
      status,
      decided_at: status === "pending_payment" ? null : new Date().toISOString(),
      paid_via: status === "paid" ? "manual" : null,
    })
    .eq("id", id);
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/students");
  return { error: null, success: true };
}

// Automatic payments with the school's own Banquest account (2026-11-19). The key goes to the ds-banquest
// Edge Function, which stores it in Supabase Vault; it is never kept or returned here.
const BANQUEST_ERRORS: Record<string, string> = {
  KEY_REJECTED: "Banquest didn't accept that key. Check the source key and the PIN.",
  PAGE_NOT_FOUND: "Banquest has no payment page with that name. Use the last part of your payment page address.",
  PAGE_FIELDS: "Banquest couldn't prepare a payment link for that page.",
  PROVIDER_ERROR: "Banquest answered with an error. Try again in a minute.",
  PROVIDER_UNREACHABLE: "Couldn't reach Banquest. Try again in a minute.",
  WEBHOOK_LIMIT: "Your Banquest account already has 10 notification addresses, the maximum. Remove one in your Banquest Control Panel and try again.",
  WEBHOOK_FAILED: "Banquest wouldn't register the payment notification.",
  SERVICE_DOWN: "Automatic payments aren't available right now. Try again later.",
  FORBIDDEN: "Only the school's owner or an admin can connect payments.",
  INVALID: "Check the payment page name and the key.",
};

async function banquestCall(path: "connect" | "disconnect", body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; detail?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "FORBIDDEN" };
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ds-banquest/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      },
      body: JSON.stringify(body),
    });
    const r = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; detail?: string };
    if (res.ok && r.ok) return { ok: true };
    // 404 with no answer from our function: the payments service is not deployed in this environment.
    return { ok: false, error: r.error ?? (res.status === 404 ? "SERVICE_DOWN" : "PROVIDER_ERROR"), detail: r.detail };
  } catch {
    return { ok: false, error: "PROVIDER_UNREACHABLE" };
  }
}

export async function connectBanquest(_p: ActionState, fd: FormData): Promise<ActionState> {
  const org = await orgId();
  if (!org) return { error: "No fleet.", success: false };
  const r = await banquestCall("connect", {
    org,
    page_slug: text(fd, "page_slug", 80) ?? "",
    source_key: text(fd, "source_key", 200) ?? "",
    pin: text(fd, "pin", 60) ?? "",
    environment: fd.get("sandbox") === "on" ? "sandbox" : "production",
  });
  if (!r.ok) {
    const base = BANQUEST_ERRORS[r.error ?? ""] ?? "Couldn't connect Banquest. Try again.";
    return { error: r.detail ? `${base} (${r.detail.slice(0, 160)})` : base, success: false };
  }
  revalidatePath("/admin/students", "layout");
  return { error: null, success: true };
}

export async function disconnectBanquest(): Promise<ActionState> {
  const org = await orgId();
  if (!org) return { error: "No fleet.", success: false };
  const r = await banquestCall("disconnect", { org });
  if (!r.ok) return { error: BANQUEST_ERRORS[r.error ?? ""] ?? "Couldn't disconnect. Try again.", success: false };
  revalidatePath("/admin/students", "layout");
  return { error: null, success: true };
}
