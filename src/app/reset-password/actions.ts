"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { PENDING_RESET_EMAIL_COOKIE } from "@/lib/auth/reset-email-cookie";

export type ResetPasswordState = { error: string | null };

// REAL BUG FOUND LIVE (2026-09-23): this project's Supabase email
// template sends the reset as a 6-digit CODE (Supabase's {{ .Token }}
// template var), not only a clickable link -- /auth/confirm handles the
// link path (token_hash in the URL, exchanged automatically before
// /reset-password/new ever renders), but there was nowhere on the whole
// site to type the code itself. Two separate steps/pages on purpose
// (explicit user request): this one only ever verifies the code and
// opens a real recovery session -- it never touches a password. The new
// password is a completely separate page/action (reset-password/new),
// so a wrong code never has to be re-typed alongside two password
// fields, and the password step can't be reached at all without a real
// verified session first.
export async function verifyResetCode(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const code = String(formData.get("code") ?? "").trim();

  if (!code) {
    return { error: "Enter the code from your email." };
  }

  // Explicit user request: no email field on this page -- read back the
  // cookie forgot-password's own action set when the code was requested.
  // Missing/expired cookie means either it's been more than 15 minutes
  // or this page was reached without ever requesting a code -- same
  // "start over" outcome either way, verifyOtp has nothing to check
  // against without an email.
  const cookieStore = await cookies();
  const email = cookieStore.get(PENDING_RESET_EMAIL_COOKIE)?.value;
  if (!email) {
    return { error: "Your reset session expired. Request a new code." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "recovery",
  });
  if (error) {
    return { error: "That code is invalid or expired. Request a new one." };
  }

  cookieStore.delete(PENDING_RESET_EMAIL_COOKIE);
  redirect("/reset-password/new");
}

// Explicit user request (2026-09-23): stronger than the plain "8
// characters" rule this used to have -- an uppercase letter, a number,
// and a symbol are all required now, not just length.
function passwordIssue(password: string, confirmPassword: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include at least one symbol.";
  if (password !== confirmPassword) return "Passwords don't match.";
  return null;
}

export async function updatePassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const issue = passwordIssue(password, confirmPassword);
  if (issue) {
    return { error: issue };
  }

  const supabase = await createClient();

  // The recovery session (from /auth/confirm's verifyOtp, or from
  // verifyResetCode above) is what authorizes this update -- never trust
  // a user id from the request, same discipline as every other write in
  // this app. No session here means someone reached this URL directly
  // without verifying a code or a link first.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/reset-password?expired=1");
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
