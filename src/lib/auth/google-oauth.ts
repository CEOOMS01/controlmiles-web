"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

// Shared by /login and /signup (explicit user request, 2026-09-18) --
// Google doesn't distinguish "sign in" from "sign up": Supabase creates
// the account on first OAuth sign-in and reuses it on every one after,
// so one action covers both entry points. redirectTo points at
// /auth/confirm, which already handles the OTP-link case for password
// reset -- extended in that same file to also exchange the `code` this
// flow redirects back with (PKCE), then decide /admin vs /app-required
// exactly like the password sign-in path does.
export type GoogleOAuthState = { error: string | null };

export async function signInWithGoogle(
  _prevState: GoogleOAuthState,
): Promise<GoogleOAuthState> {
  const supabase = await createClient();
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : "https://controlmiles.com";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/confirm` },
  });

  if (error || !data.url) {
    return { error: AppError.from(error ?? new Error("No OAuth URL returned")).display() };
  }

  redirect(data.url);
}
