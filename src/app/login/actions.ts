"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Generic message on purpose -- never confirm/deny which part
    // (email vs password) was wrong.
    return { error: "Invalid email or password." };
  }

  // Real bug found live (2026-09-09): this used to gate on
  // profiles.account_type === "fleet_admin", but account_type is the
  // MOBILE APP's current Personal/Company UI toggle (see
  // OrgModeSwitcher/switch_account_mode in the ControlMiles-app repo) --
  // a genuine org owner who happens to be viewing Personal mode on their
  // phone has account_type='gig' and was wrongly bounced to
  // /app-required, even though /admin/layout.tsx's own (correct) check
  // would have let them straight in. Mirrors that layout's real
  // authorization check instead: does this account own/admin at least
  // one active organization, independent of whatever mode their phone
  // happens to be showing right now.
  const { data: adminMemberships } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", data.user.id)
    .in("member_role", ["owner", "admin"])
    .eq("is_active", true)
    .limit(1);

  // Explicit user requirement (2026-09-09): controlmiles.com is
  // fleet-admin only going forward. Used to send everyone else to
  // /portal/generate (the driver report-code flow) -- that moved to the
  // mobile app's Settings screen, so this now sends a non-admin
  // somewhere that actually tells them what to do instead of a stale
  // destination whose whole reason to exist just relocated.
  redirect((adminMemberships?.length ?? 0) > 0 ? "/admin" : "/app-required");
}
