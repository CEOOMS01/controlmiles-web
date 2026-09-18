"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type ForgotPasswordState = { error: string | null; sent: boolean };

/**
 * Sends a password-reset email via Supabase Auth. Deliberately always
 * reports success back to the UI (even when the email doesn't match any
 * account) -- confirming/denying that an email is registered is a real
 * account-enumeration leak, and Supabase's own resetPasswordForEmail
 * already returns the same generic response either way, so there's
 * nothing meaningful to distinguish here anyway.
 *
 * redirectTo is built from the request's own Host header rather than a
 * hardcoded domain -- this app has no NEXT_PUBLIC_SITE_URL env var, and
 * the request's own origin is correct in every environment (prod,
 * preview deploys, localhost) without needing one.
 */
export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter your email.", sent: false };
  }

  const supabase = await createClient();
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : "https://controlmiles.com";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  // Only a real, non-enumeration error (rate limit, malformed email)
  // surfaces to the user -- "no such account" is intentionally
  // indistinguishable from success.
  if (error && error.code !== "user_not_found") {
    return { error: AppError.from(error).display(), sent: false };
  }

  return { error: null, sent: true };
}
