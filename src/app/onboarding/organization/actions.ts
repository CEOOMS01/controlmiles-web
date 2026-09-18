"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type CreateOrgState = { error: string | null };

// Explicit user requirement (2026-09-18): "primero se loguea y luego
// crea la organización" -- the step this page/action covers only
// exists for an OAuth (Google) sign-in, which has no form to carry an
// org name through the way the password /signup flow does
// (raw_user_meta_data set at supabase.auth.signUp() call time, read by
// the handle_new_user trigger). This calls the same create_organization
// RPC signup's DB trigger calls under the hood -- atomic: creates the
// org, makes the caller its owner, promotes their profile to
// fleet_admin, all in one transaction (see
// 20260825021133_create_organization_rpc.sql in the mobile repo).
export async function createOrganization(
  _prevState: CreateOrgState,
  formData: FormData,
): Promise<CreateOrgState> {
  const orgName = String(formData.get("orgName") ?? "").trim();

  if (!orgName) {
    return { error: "Enter your company or fleet name." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", { p_name: orgName });

  if (error) {
    return { error: AppError.from(error).display() };
  }

  redirect("/admin");
}
