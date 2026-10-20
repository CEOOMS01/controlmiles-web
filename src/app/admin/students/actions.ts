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
  };
}

function checkStudent(f: ReturnType<typeof studentFields>): string | null {
  if (!f.first_name || !f.last_name) return "Enter the student's first and last name.";
  if (f.email && !EMAIL.test(f.email)) return "The student's email doesn't look right.";
  if (f.guardian_email && !EMAIL.test(f.guardian_email)) return "The guardian's email doesn't look right.";
  if (!["registered", "active", "finished", "dropped"].includes(f.status)) return "Pick a status.";
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
  const hours = Number(text(fd, "required_hours", 8) ?? "0");
  const night = Number(text(fd, "required_night_hours", 8) ?? "0");
  const reminder = Number(text(fd, "reminder_hours", 4) ?? "24");
  if (!(hours >= 0 && hours <= 1000) || !(night >= 0 && night <= hours)) {
    return { error: "Night hours can't be more than the required hours.", success: false };
  }
  if (!(reminder >= 1 && reminder <= 168)) return { error: "Reminder: 1 to 168 hours before.", success: false };
  const supabase = await createClient();
  const { error } = await supabase.from("ds_settings").upsert(
    {
      organization_id: org,
      required_minutes: Math.round(hours * 60),
      required_night_minutes: Math.round(night * 60),
      reminder_hours: Math.round(reminder),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin/students", "layout");
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
