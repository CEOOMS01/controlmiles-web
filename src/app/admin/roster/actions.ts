"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

// Explicit user request, 2026-09-26: "Add driver" and "Invite driver" used
// to be two separate cards (one emailed an invitation, the other produced a
// one-time code to hand over by hand). It is ONE form now: name + email and
// the invitation is emailed -- like Motive's Fleet Users. The one-time code
// remains available, inside the same form, for a driver who has no email
// (delivery = "code"): same RPCs, same authorization, nothing removed.
export type AddDriverResult =
  | { kind: "invited"; email: string }
  | { kind: "code"; displayId: string; claimCode: string };

export type AddDriverState = { error: string | null; result: AddDriverResult | null };

const SEND_FAILED_MESSAGE =
  "The driver was added, but the invitation email did not go out. Use “Resend invitation” on their row.";

// Delivers the invitation email for a token create_driver_invite /
// resend_driver_invite just returned. supabase.functions.invoke() carries the
// caller's own session as the Authorization header automatically -- the same
// identity send-driver-invite re-verifies server-side before it will send
// anything (it never trusts a client-supplied email/org, only the token).
async function deliverInvite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  token: string,
): Promise<boolean> {
  const { error } = await supabase.functions.invoke("send-driver-invite", { body: { token } });
  return !error;
}

export async function addDriver(
  _prevState: AddDriverState,
  formData: FormData,
): Promise<AddDriverState> {
  const orgId = String(formData.get("org_id") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  // Which roles THIS caller may actually grant lives server-side in
  // create_driver_invite itself (owner-only for 'admin', admin-or-owner for
  // 'operator'); the form's role list is only UX.
  const role = String(formData.get("role") ?? "driver").trim();
  const viaCode = String(formData.get("delivery") ?? "email") === "code";

  if (!orgId || !firstName || !lastName) {
    return { error: "Enter a first and last name.", result: null };
  }

  const supabase = await createClient();

  if (viaCode) {
    // In-person path: a slot plus a one-time code, no email involved.
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
      return { error: "Could not create the driver. Try again.", result: null };
    }
    revalidatePath("/admin/roster");
    return { error: null, result: { kind: "code", displayId: row.display_id, claimCode: row.claim_code } };
  }

  if (!email) {
    return {
      error: "Enter an email address, or choose the one-time code option.",
      result: null,
    };
  }

  // The driver's ControlMiles ID (CM-D####, what they log in with once the
  // fleet_driver account exists) is reserved up front from the name given
  // here -- see create_driver_invite.
  const { data: token, error: createError } = await supabase.rpc("create_driver_invite", {
    p_org_id: orgId,
    p_email: email,
    p_first_name: firstName,
    p_last_name: lastName,
    p_intended_role: role,
  });

  if (createError) {
    // The RPC's own exceptions are already user-facing sentences; AppError
    // recognizes them as business-rule rejections instead of raw Postgres.
    return { error: AppError.from(createError).display(), result: null };
  }

  const sent = await deliverInvite(supabase, token as string);
  // Revalidate either way: the driver row exists now, so it must show up on
  // the roster (as Invited) even if the email needs a resend.
  revalidatePath("/admin/roster");
  if (!sent) {
    return { error: SEND_FAILED_MESSAGE, result: null };
  }
  return { error: null, result: { kind: "invited", email: email.toLowerCase() } };
}

// Explicit user request, 2026-09-26: a pending invitation is shown on the
// roster as "Invited" with a Resend action. resend_driver_invite issues a
// fresh link for the SAME driver row (it never mints another CM-D####) and
// expires the previous link; same authority hierarchy as creating it.
export async function resendDriverInvite(inviteId: string): Promise<{ error: string | null }> {
  if (!inviteId) return { error: "Invitation not found." };

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("resend_driver_invite", {
    p_invite_id: inviteId,
  });
  if (error) {
    return { error: AppError.from(error).display() };
  }

  const sent = await deliverInvite(supabase, token as string);
  revalidatePath("/admin/roster");
  if (!sent) {
    return { error: "A new link was created, but the email did not go out. Try again." };
  }
  return { error: null };
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

// Owner-only, real question answered live (explicit user request,
// 2026-09-18): "y el rol admin que solo un owner puede ascender?" --
// auditing the DB found a real pre-existing gap where any plain admin
// could already do this via a raw table update; set_member_admin's own
// WHERE clause (member_role IN ('driver','operator','admin')) is the
// real safety boundary, not just the is_org_owner check inside it -- it
// has no code path that can ever reach an owner's row. Same call-site
// shape as setMemberOperator.
export async function setMemberAdmin(
  orgId: string,
  userId: string,
  makeAdmin: boolean,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_admin", {
    p_org_id: orgId,
    p_user_id: userId,
    p_make_admin: makeAdmin,
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
