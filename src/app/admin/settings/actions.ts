"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
    return { error: error.message, success: false };
  }

  revalidatePath("/admin", "layout");
  return { error: null, success: true };
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
    return { error: error.message, success: false };
  }

  revalidatePath("/admin", "layout");
  return { error: null, success: true };
}
