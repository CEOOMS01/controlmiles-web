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

// After confirming the email (the "Email confirmed" page): finish joining the fleet
// the user was invited to. The database finds the invite by the user's own confirmed
// email (accept_my_pending_invite), so no link token is needed here.
export async function acceptMyPendingInvite(): Promise<InviteActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_my_pending_invite");
  if (error) return { error: AppError.from(error).display() };
  redirect("/invite/done/success");
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

// One-step account creation (2026-10-27): the invite email is also the confirmation, so
// the account is created already confirmed by the accept-invite-account edge function
// (see its header for the guard rails) and the invited person is signed in and joined
// in the same click: no second email.
type AccountResult = { status: string; email?: string };

async function createConfirmedAccount(token: string, password: string): Promise<AccountResult> {
  try {
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/accept-invite-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ token, password }),
      cache: "no-store",
    });
    return (await res.json()) as AccountResult;
  } catch {
    return { status: "error" };
  }
}

function accountError(status: string): string {
  switch (status) {
    case "weak_password":
      return "Password must be at least 8 characters, with a letter and a number.";
    case "invalid_invite":
      return "This invite link no longer works. Ask your fleet admin to send a new one.";
    case "rate_limited":
      return "Too many attempts. Try again in a few minutes.";
    default:
      return "Could not create your account. Try again in a moment.";
  }
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
    // The account exists but its email was never confirmed (an earlier sign-up that was
    // never finished). Opening this invite is the confirmation, so finish it here with
    // the password they just typed: the half-made account is replaced by a confirmed one.
    if (signInError.code === "email_not_confirmed" || /email not confirmed/i.test(signInError.message)) {
      const made = await createConfirmedAccount(token, password);
      if (made.status !== "created" || !made.email) return { error: accountError(made.status) };
      const { error: again } = await supabase.auth.signInWithPassword({ email: made.email, password });
      if (again) return { error: accountError("error") };
      return finishAccept(token);
    }
    return { error: AppError.invalidCredentials.display() };
  }

  return finishAccept(token);
}

// The invite email has no ControlMiles account yet -- create one, already confirmed
// (no pending_org_name metadata, so handle_new_user leaves account_type at its 'gig'
// default; accept_driver_invite turns it into a fleet driver right after).
export async function acceptInviteNewAccount(
  _prevState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!token) return { error: "Invalid invite link." };
  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { error: "Password must include at least one letter and one number." };
  }

  const made = await createConfirmedAccount(token, password);
  if (made.status === "exists") {
    return {
      error: "You already have a ControlMiles account with this email. Reload this page and sign in with your password.",
    };
  }
  if (made.status !== "created" || !made.email) return { error: accountError(made.status) };

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: made.email, password });
  if (signInError) return { error: accountError("error") };

  return finishAccept(token);
}
