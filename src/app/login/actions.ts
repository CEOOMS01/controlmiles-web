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

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", data.user.id)
    .maybeSingle();

  // Explicit user requirement (2026-09-09): controlmiles.com is
  // fleet-admin only going forward. Used to send everyone else to
  // /portal/generate (the driver report-code flow) -- that moved to the
  // mobile app's Settings screen, so this now sends a non-admin
  // somewhere that actually tells them what to do instead of a stale
  // destination whose whole reason to exist just relocated.
  redirect(profile?.account_type === "fleet_admin" ? "/admin" : "/app-required");
}
