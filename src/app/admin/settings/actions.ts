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
