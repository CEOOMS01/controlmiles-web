"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type ResetPasswordState = { error: string | null };

export async function updatePassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();

  // The recovery session (from /auth/confirm's verifyOtp) is what
  // authorizes this update -- never trust a user id from the request,
  // same discipline as every other write in this app.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/forgot-password?expired=1");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: AppError.from(error).display() };
  }

  // Explicit sign-out after a successful reset (mirrors the mobile
  // app's reset_password_screen.dart -- same reasoning: the recovery
  // session is single-purpose, and the user should sign back in fresh
  // with their new password rather than silently landing in /admin off
  // a lingering recovery token).
  await supabase.auth.signOut();
  redirect("/login?reset=1");
}
