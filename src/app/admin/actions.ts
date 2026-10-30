"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type CreateOrgState = { error: string | null };

export async function switchOrganization(orgId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("switch_default_organization", { p_org_id: orgId });
  if (error) {
    return { error: AppError.from(error).display() };
  }
  // The admin layout (menu, org selector, features) is kept between pages, so
  // after a switch it still showed the previous org's menu -- a cargo fleet
  // saw the school bus menu (2026-10-30). Re-render it for the new org.
  revalidatePath("/admin", "layout");
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
  // No fleet type here (2026-09-30): it's chosen in onboarding
  // (/onboarding/fleet-type), which admin/layout.tsx sends the owner to.
  const { error } = await supabase.rpc("create_organization", { p_name: name });

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
