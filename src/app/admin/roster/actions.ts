"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type InviteState = { error: string | null; success: boolean };

export async function inviteMember(
  _prevState: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const orgId = String(formData.get("org_id") ?? "");
  const email = String(formData.get("email") ?? "").trim();

  if (!orgId || !email) {
    return { error: "Enter an email address.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_member_by_email", {
    p_org_id: orgId,
    p_email: email,
  });

  if (error) {
    // The RPC's own exceptions are already user-facing sentences
    // ("No ControlMiles account found for that email", etc.) --
    // AppError.from recognizes these aren't raw Postgres internals and
    // routes them to the 450 (business rule rejection) code instead of
    // downgrading to a generic message.
    return { error: AppError.from(error).display(), success: false };
  }

  revalidatePath("/admin/roster");
  return { error: null, success: true };
}

export async function removeMember(membershipId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  // RLS (org_members_delete_admin_or_self) is what actually enforces
  // this -- the caller must be the org's admin/owner or the member
  // themselves. No extra check needed here.
  //
  // BUG FIX (pedido explícito, 2026-09-09): esta acción nunca chequeaba
  // el error de Supabase -- si el delete fallaba (ej. rechazo de RLS),
  // no pasaba nada visible: revalidatePath corría igual y la fila
  // seguía ahí sin ninguna explicación de por qué.
  const { error } = await supabase.from("organization_members").delete().eq("id", membershipId);
  if (error) {
    return { error: AppError.from(error).display() };
  }
  revalidatePath("/admin/roster");
  return { error: null };
}

export type AddSlotState = {
  error: string | null;
  result: { displayId: string; claimCode: string } | null;
};

export async function addDriverSlot(
  _prevState: AddSlotState,
  formData: FormData,
): Promise<AddSlotState> {
  const orgId = String(formData.get("org_id") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();

  if (!orgId || !firstName || !lastName) {
    return { error: "Enter a first and last name.", result: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_driver_slot", {
    p_org_id: orgId,
    p_first_name: firstName,
    p_last_name: lastName,
  });

  if (error) {
    return { error: AppError.from(error).display(), result: null };
  }

  const row = data?.[0];
  if (!row) {
    return { error: "Could not create the driver slot. Try again.", result: null };
  }

  revalidatePath("/admin/roster");
  return { error: null, result: { displayId: row.display_id, claimCode: row.claim_code } };
}

export async function removeDriverSlot(slotId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  // RLS (fleet_driver_slots_delete_admin) enforces the caller is this
  // org's admin/owner.
  const { error } = await supabase.from("fleet_driver_slots").delete().eq("id", slotId);
  if (error) {
    return { error: AppError.from(error).display() };
  }
  revalidatePath("/admin/roster");
  return { error: null };
}

// Real fix, not a pricing-copy edit (explicit user request, 2026-09-18):
// the pricing page has promised "Report Portal for any driver" on the
// Starter tier since it shipped, but until today there was no way for an
// admin to actually do this -- generate_report_access_code only ever
// generated a code for the caller's own trips. This is the admin-facing
// call site for the p_target_user_id param added in migration
// 20260918100000_report_portal_admin_target_driver.sql. No
// p_weekly_checkpoints here on purpose: that param needs signed Storage
// URLs the admin has no RLS access to sign (only the driver's own
// authenticated client can, see portal/generate/actions.ts's own header
// comment) -- an admin-generated report covers real GPS mileage/trip
// data, just without the odometer-photo pairs a driver generating their
// own report gets. A real, disclosed v1 scope cut, not an oversight.
export type GenerateReportState = {
  error: string | null;
  result: { code: string; expiresAt: string } | null;
};

export async function generateReportForDriver(
  driverUserId: string,
  startDate: string,
  endDate: string,
): Promise<GenerateReportState> {
  if (!driverUserId || !startDate || !endDate) {
    return { error: "Pick a date range.", result: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_report_access_code", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_target_user_id: driverUserId,
  });

  if (error) {
    return { error: AppError.from(error).display(), result: null };
  }

  const row = data?.[0];
  if (!row) {
    return { error: "Could not generate a report code. Try again.", result: null };
  }

  return { error: null, result: { code: row.code, expiresAt: row.expires_at } };
}
