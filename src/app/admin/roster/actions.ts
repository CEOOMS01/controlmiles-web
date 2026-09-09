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

export async function removeMember(membershipId: string) {
  const supabase = await createClient();
  // RLS (org_members_delete_admin_or_self) is what actually enforces
  // this -- the caller must be the org's admin/owner or the member
  // themselves. No extra check needed here.
  await supabase.from("organization_members").delete().eq("id", membershipId);
  revalidatePath("/admin/roster");
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

export async function removeDriverSlot(slotId: string) {
  const supabase = await createClient();
  // RLS (fleet_driver_slots_delete_admin) enforces the caller is this
  // org's admin/owner.
  await supabase.from("fleet_driver_slots").delete().eq("id", slotId);
  revalidatePath("/admin/roster");
}
