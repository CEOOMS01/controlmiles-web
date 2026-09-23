"use server";

// Olympus Mont Systems LLC - ControlMiles
// src/app/invite/[token]/actions.ts
//
// REAL BUG FOUND LIVE (2026-09-23): send-driver-invite's email has
// linked to https://controlmiles.com/invite/<token> since the invite
// system shipped, but nothing at that URL ever existed -- every invite
// ever sent 404'd on click. This is the landing screen's own server
// actions. Deliberately NOT reusing /login's signIn action: that one
// hardcodes a fleet-admin-only redirect (`(adminMemberships?.length ?? 0)
// > 0 ? "/admin" : "/app-required"`), which would silently bounce an
// invited driver to /app-required mid-accept instead of finishing the
// invite. Three real states an invite can arrive at, three actions.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type InviteActionState = { error: string | null };

async function finishAccept(token: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_driver_invite", { p_token: token });
  if (error) {
    return { error: AppError.from(error).display() };
  }
  redirect(`/invite/${token}/success`);
}

// Already authenticated, and the caller's own email already matches the
// invite (checked again here server-side, not just trusted from what the
// page rendered -- accept_driver_invite itself also re-checks this, so
// this is a better error message, not the real security boundary).
export async function acceptInviteAlreadySignedIn(
  token: string,
): Promise<InviteActionState> {
  return finishAccept(token);
}

// The invite email already has a ControlMiles account -- sign in with
// their existing password, then accept.
export async function acceptInviteExistingAccount(
  _prevState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!token) return { error: "Invalid invite link." };
  if (!password) return { error: "Enter your password." };

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return { error: AppError.invalidCredentials.display() };
  }

  return finishAccept(token);
}

// The invite email has no ControlMiles account yet -- create one (no
// pending_org_name metadata, unlike signup/actions.ts's signUp, so
// handle_new_user leaves account_type at its 'gig' default instead of
// creating a whole new organization and promoting to fleet_admin --
// accept_driver_invite is what turns this into a fleet_driver, right
// after).
export async function acceptInviteNewAccount(
  _prevState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!token) return { error: "Invalid invite link." };
  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { error: "Password must include at least one letter and one number." };
  }

  const supabase = await createClient();
  const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
  if (signUpError) {
    return { error: AppError.from(signUpError).display() };
  }
  if (!data.session) {
    // Email confirmation is required before a session exists -- accepting
    // the invite has to wait until they confirm and come back. Rare in
    // practice (this project's driver accounts don't normally require
    // confirmation), but handled rather than silently failing the accept.
    return {
      error:
        "Account created — check your email to confirm it, then open this invite link again to finish joining.",
    };
  }

  return finishAccept(token);
}
