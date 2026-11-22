"use server";

// School transportation, parents (2026-11-21): the office invites a parent to the
// Fleet app, re-sends the invitation and revokes access. The database decides who
// may do it (create_guardian_invite / revoke_guardian: owner or admin); the email
// comes from the send-guardian-invite edge function, which re-reads the token
// itself and only ever sends the email the database already committed to.
//
// create_guardian_invite is safe to call again for the same email: it keeps the
// parent, re-activates them, retires the old pending invitation and mints a new
// token. "Resend" uses exactly that.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { AppError } from "@/lib/errors";
import type { FormResult } from "./actions";

const PATH = "/admin/school/students";

const SEND_FAILED =
  "The parent was added, but the invitation email did not go out. Use “Resend” on their row.";

async function context() {
  const supabase = await createClient();
  const { profile } = await getAuthedProfile();
  return { supabase, orgId: profile?.default_org_id ?? null };
}

function guardianError(error: { message?: string }): FormResult {
  const m = error.message ?? "";
  if (m.includes("Only an admin or the owner")) return { error: "Only an admin or the owner can invite a parent." };
  if (m.includes("Too many invites")) return { error: "Too many invitations just now. Try again later." };
  if (m.includes("valid email")) return { error: "Enter a valid email address." };
  if (m.includes("First and last name")) return { error: "Enter the parent's first and last name." };
  if (m.includes("at least one student")) return { error: "Choose at least one student." };
  if (m.includes("does not belong to this fleet")) return { error: "A chosen student is no longer on the roster." };
  if (m.includes("only available for School transportation")) return { error: "Parents are only available for school bus fleets." };
  return { error: AppError.from(error).display() };
}

async function createAndSend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  p: { firstName: string; lastName: string; email: string; studentIds: string[] },
): Promise<FormResult> {
  const { data, error } = await supabase.rpc("create_guardian_invite", {
    p_organization_id: orgId,
    p_email: p.email,
    p_first_name: p.firstName,
    p_last_name: p.lastName,
    p_student_ids: p.studentIds,
  });
  if (error) return guardianError(error);
  const row = (Array.isArray(data) ? data[0] : data) as { token?: string } | null;
  if (!row?.token) return { error: "The invitation could not be created. Try again." };

  // supabase.functions.invoke() carries the caller's own session; the function
  // checks again that they are an owner or admin of that school.
  const { error: sendError } = await supabase.functions.invoke("send-guardian-invite", { body: { token: row.token } });
  revalidatePath(PATH);
  return sendError ? { error: SEND_FAILED } : { error: null };
}

export async function inviteParent(_: FormResult, formData: FormData): Promise<FormResult> {
  const { supabase, orgId } = await context();
  if (!orgId) return { error: "Not signed in." };
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const studentIds = formData.getAll("student_ids").map(String).filter(Boolean);
  if (!firstName || !lastName) return { error: "Enter the parent's first and last name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
  if (studentIds.length === 0) return { error: "Choose at least one student." };
  return createAndSend(supabase, orgId, { firstName, lastName, email, studentIds });
}

export async function resendParentInvite(guardianId: string): Promise<FormResult> {
  const { supabase, orgId } = await context();
  if (!orgId) return { error: "Not signed in." };
  const { data: g } = await supabase
    .from("bus_guardians")
    .select("first_name, last_name, email, user_id")
    .eq("id", guardianId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!g) return { error: "Parent not found." };
  if (g.user_id) return { error: "This parent already has access." };
  const { data: links } = await supabase
    .from("bus_student_guardians")
    .select("student_id")
    .eq("guardian_id", guardianId)
    .eq("is_active", true);
  const studentIds = (links ?? []).map((l) => l.student_id);
  if (studentIds.length === 0) return { error: "This parent has no students left. Invite them again with a student." };
  return createAndSend(supabase, orgId, { firstName: g.first_name, lastName: g.last_name, email: g.email, studentIds });
}

export async function revokeParent(guardianId: string): Promise<FormResult> {
  const { supabase } = await context();
  const { error } = await supabase.rpc("revoke_guardian", { p_guardian_id: guardianId });
  if (error) return guardianError(error);
  revalidatePath(PATH);
  return { error: null };
}

export async function unlinkParentStudent(guardianId: string, studentId: string): Promise<FormResult> {
  const { supabase } = await context();
  const { error } = await supabase.rpc("unlink_guardian_student", { p_guardian_id: guardianId, p_student_id: studentId });
  if (error) return guardianError(error);
  revalidatePath(PATH);
  return { error: null };
}
