"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type RenameOrgState = { error: string | null; success: boolean };

export async function renameOrganization(
  _prevState: RenameOrgState,
  formData: FormData,
): Promise<RenameOrgState> {
  const orgId = String(formData.get("org_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!orgId || !name) {
    return { error: "Enter a fleet name.", success: false };
  }

  const supabase = await createClient();
  // organizations_update_admin (RLS) is what actually enforces this --
  // the caller must be this org's admin/owner. This form only ever
  // submits `name` -- per the explicit rule that name is the one thing
  // an owner can freely change, nothing else (compliance_mode, ids,
  // etc. are never part of this payload).
  const { error } = await supabase
    .from("organizations")
    .update({ name })
    .eq("id", orgId);

  if (error) {
    return { error: AppError.from(error).display(), success: false };
  }

  revalidatePath("/admin", "layout");
  return { error: null, success: true };
}

export type DeleteOrgState = { error: string | null };

// Danger zone (2026-09-09, explicit user request for a fleet-enterprise-
// grade Settings page). delete_organization() already existed and was
// fully implemented -- owner-only, cascades vehicles/routes/roster,
// clears every affected driver's default_org_id back to a plain gig
// account -- but had never been wired to any UI (a real bug in the RPC
// itself was found and fixed the same day this got exposed: see
// fix_delete_organization_odometer_checkpoints_fk, a missing cleanup
// step that would have hard-failed this for any org with real usage
// history). The type-the-org-name confirmation is the same pattern
// GitHub/Vercel use for exactly this class of action -- a plain "are you
// sure?" dialog is too easy to click through without reading.
export async function deleteOrganizationAction(
  _prevState: DeleteOrgState,
  formData: FormData,
): Promise<DeleteOrgState> {
  const orgId = String(formData.get("org_id") ?? "");
  const confirmedName = String(formData.get("confirm_name") ?? "").trim();
  const actualName = String(formData.get("actual_name") ?? "").trim();

  if (!orgId) {
    return { error: "Missing organization." };
  }
  if (confirmedName !== actualName) {
    return { error: "Type the fleet name exactly to confirm." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_organization", { p_org_id: orgId });

  if (error) {
    // critical:true -- this is the org-deletion action, gets code 720
    // instead of a generic 701 if something unexpected happens here.
    return { error: AppError.from(error, { critical: true }).display() };
  }

  redirect("/admin");
}

export type VehicleAssignmentModeState = { error: string | null; success: boolean };

// Fleet Sprint 4 (open/rotating vehicle assignment, explicit user
// requirement, 2026-09-09): 'fixed' -- today's only behavior, admin
// pre-assigns one vehicle per driver -- vs 'open' -- driver picks from
// the org's vehicle list at trip start. Standing rule, reaffirmed by the
// user this same session: admin-facing Fleet configuration lives here on
// the web dashboard exclusively, not in the mobile app.
export async function setVehicleAssignmentMode(
  _prevState: VehicleAssignmentModeState,
  formData: FormData,
): Promise<VehicleAssignmentModeState> {
  const orgId = String(formData.get("org_id") ?? "");
  const mode = String(formData.get("vehicle_assignment_mode") ?? "");

  if (!orgId || (mode !== "fixed" && mode !== "open")) {
    return { error: "Invalid selection.", success: false };
  }

  const supabase = await createClient();
  // organizations_update_admin (RLS) enforces the caller is this org's
  // admin/owner -- same mechanism renameOrganization above already uses.
  const { error } = await supabase
    .from("organizations")
    .update({ vehicle_assignment_mode: mode })
    .eq("id", orgId);

  if (error) {
    return { error: AppError.from(error).display(), success: false };
  }

  revalidatePath("/admin", "layout");
  return { error: null, success: true };
}

export type TimeFormatState = { error: string | null; success: boolean };

// Personal preference (explicit user request, 2026-09-22), not an org
// setting -- lives on profiles same as mileage_method, not organizations,
// since two admins signed into the same fleet may each want their own
// clock format. Only ever updates the caller's own row (no org_id/target
// user param at all) so there's no authorization check to get wrong.
export async function setTimeFormat(
  _prevState: TimeFormatState,
  formData: FormData,
): Promise<TimeFormatState> {
  const format = String(formData.get("time_format") ?? "");
  if (format !== "12h" && format !== "24h") {
    return { error: "Invalid selection.", success: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", success: false };

  const { error } = await supabase
    .from("profiles")
    .update({ time_format: format })
    .eq("id", user.id);

  if (error) {
    return { error: AppError.from(error).display(), success: false };
  }

  revalidatePath("/admin", "layout");
  return { error: null, success: true };
}
