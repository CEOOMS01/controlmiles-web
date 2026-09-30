"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { fleetTypeFrom } from "@/components/fleet-type-picker";

export type CreateOrgState = { error: string | null };

export async function switchOrganization(orgId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("switch_default_organization", { p_org_id: orgId });
  if (error) {
    return { error: AppError.from(error).display() };
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
  const { error } = await supabase.rpc("create_organization", {
    p_name: name,
    p_industry_template: fleetTypeFrom(formData),
  });

  if (error) {
    return { error: AppError.from(error).display() };
  }

  redirect("/admin");
}

// REAL BUG (2026-09-29): sign-out used the browser client, which can't
// see middleware.ts's httpOnly auth cookies -- once the session had been
// refreshed once, signOut() found no session, cleared nothing and the
// admin stayed signed in. The server client reads and clears them.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
