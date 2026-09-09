"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signUp(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const orgName = String(formData.get("orgName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!orgName) {
    return { error: "Enter your company or fleet name." };
  }
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();

  // pending_org_name rides in raw_user_meta_data and is read by the
  // handle_new_user trigger, which creates the organization and promotes
  // this account to fleet_admin atomically at signup time -- works
  // whether or not this Supabase project requires email confirmation
  // before a session exists (see supabase/migrations/
  // 20260909080000_signup_creates_fleet_org_from_metadata.sql in the
  // mobile repo).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { pending_org_name: orgName } },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.session) {
    redirect("/admin");
  }

  redirect("/signup/check-email");
}
