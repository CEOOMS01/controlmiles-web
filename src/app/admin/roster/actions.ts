"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
    // ("No ControlMiles account found for that email", etc.) -- safe
    // to surface directly, unlike a raw Postgres error.
    return { error: error.message, success: false };
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
