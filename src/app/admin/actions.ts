"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CreateOrgState = { error: string | null };

export async function switchOrganization(orgId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("switch_default_organization", { p_org_id: orgId });
  if (error) {
    return { error: error.message };
  }
  redirect("/admin");
}

export async function createOrganization(
  _prevState: CreateOrgState,
  formData: FormData,
): Promise<CreateOrgState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Enter an organization name." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", { p_name: name });

  if (error) {
    return { error: error.message };
  }

  redirect("/admin");
}
