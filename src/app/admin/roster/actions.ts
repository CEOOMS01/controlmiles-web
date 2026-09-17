"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type InviteState = { error: string | null; success: boolean };

// Real fix, not a caveat left in place (explicit user request,
// 2026-09-18): create_driver_invite/resolve_driver_invite/
// accept_driver_invite (migration 20260904060000_driver_invites.sql) and
// send-driver-invite (the branded Resend email, see its own header
// comment) were both fully built and working, but nothing anywhere ever
// called create_driver_invite -- the invite dialog called the OLDER,
// strictly weaker invite_member_by_email instead, which only works for
// an email that already has a ControlMiles account. This IS that missing
// call site: create the invite (gets back a one-time token), then invoke
// the edge function to actually send it. supabase.functions.invoke()
// carries the caller's own session as the Authorization header
// automatically -- the same identity send-driver-invite re-verifies
// server-side before it will send anything (see its own header comment
// on why it never trusts a client-supplied email/org).
export async function inviteMember(
  _prevState: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const orgId = String(formData.get("org_id") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();

  if (!orgId || !email || !firstName || !lastName) {
    return { error: "Enter a first name, last name, and email address.", success: false };
  }

  const supabase = await createClient();
  // Real fix, not a caveat left in place (explicit user request,
  // 2026-09-17): the driver's ControlMiles ID (CM-D####, what they'll log
  // in with once fleet_driver accounts stop using email/password -- see
  // resolve-driver-login) used to only exist for the in-person claim-code
  // path -- an email-invited driver never got one. create_driver_invite
  // now reserves it up front from the name given here, same trigger/
  // format as the claim-code path (fn_assign_driver_slot_display_id, see
  // migration 20260917220000_driver_id_login.sql).
  const { data: token, error: createError } = await supabase.rpc("create_driver_invite", {
    p_org_id: orgId,
    p_email: email,
    p_first_name: firstName,
    p_last_name: lastName,
  });

  if (createError) {
    // The RPC's own exceptions are already user-facing sentences
    // ("This person already owns their own fleet...", etc.) --
    // AppError.from recognizes these aren't raw Postgres internals and
    // routes them to the 450 (business rule rejection) code instead of
    // downgrading to a generic message.
    return { error: AppError.from(createError).display(), success: false };
  }

  const { error: sendError } = await supabase.functions.invoke("send-driver-invite", {
    body: { token },
  });

  if (sendError) {
    return {
      error: "Invite created but the email failed to send. Try again.",
      success: false,
    };
  }

  revalidatePath("/admin/roster");
  return { error: null, success: true };
}

// Real feature, not a caveat left in place (explicit user request,
// 2026-09-18): "Operator" is a real third membership tier below owner/
// admin -- an admin the owner (or an existing admin) can delegate
// day-to-day fleet operations to. The real safety boundary is
// set_member_operator's own SQL (see migration 20260918000000_operator_
// role.sql) -- it can only ever touch a row that's already 'driver' or
// 'operator', so this action has no path to ever reach an owner's or an
// existing admin's row, even called with the wrong user_id. This is
// just the client-facing call site.
export async function setMemberOperator(
  orgId: string,
  userId: string,
  makeOperator: boolean,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_operator", {
    p_org_id: orgId,
    p_user_id: userId,
    p_make_operator: makeOperator,
  });
  if (error) {
    return { error: AppError.from(error).display() };
  }
  revalidatePath("/admin/roster");
  return { error: null };
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
