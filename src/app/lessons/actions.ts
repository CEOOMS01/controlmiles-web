"use server";

// Driving school client portal (2026-10-22): adult students and parents of
// minors, on the website only. Sign-in is a one-time link by email
// (ds-portal-access); opening it makes a 30-day session kept in an httpOnly
// cookie. The database decides everything else (ds_client_* functions):
// who may see which student, majority and emancipation, and that a child a
// parent adds waits for the school's approval.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { LESSONS_COOKIE, LESSONS_MAX_AGE, lessonsSession } from "@/lib/lessons-session";

export type RequestLinkState = { error: string | null; sent: boolean };

export async function requestLink(_prev: RequestLinkState, fd: FormData): Promise<RequestLinkState> {
  const email = String(fd.get("email") ?? "").trim().slice(0, 120);
  if (!email) return { error: AppError.invalidFormInput.display(), sent: false };
  const supabase = await createClient();
  const { error } = await supabase.functions.invoke("ds-portal-access", { body: { email } });
  // The function answers the same for any email; only its rate limit and
  // real failures come back as errors.
  if (error) {
    const status = (error as { context?: Response }).context?.status;
    return { error: (status === 429 ? AppError.rateLimited : AppError.unexpectedServer).display(), sent: false };
  }
  return { error: null, sent: true };
}

export type OpenLinkState = { error: string | null };

export async function openLink(token: string): Promise<OpenLinkState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ds_client_open_link", { p_token: token });
  if (error) return { error: AppError.from(error).display() };
  if (!data) return { error: "This link has expired or was already used. Ask for a new one below." };
  (await cookies()).set(LESSONS_COOKIE, String(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/lessons",
    maxAge: LESSONS_MAX_AGE,
  });
  redirect("/lessons");
}

export async function signOut(): Promise<void> {
  const session = await lessonsSession();
  if (session) {
    const supabase = await createClient();
    await supabase.rpc("ds_client_sign_out", { p_session: session });
  }
  (await cookies()).delete({ name: LESSONS_COOKIE, path: "/lessons" });
  redirect("/lessons");
}

export type AddChildState = { error: string | null; done: boolean };

const CHILD_MESSAGES: Record<string, string> = {
  SESSION_ENDED: "You've been signed out. Sign in again to continue.",
  NOT_AVAILABLE: "This school isn't taking online requests right now. Contact the school directly.",
  NAME_REQUIRED: "Enter your child's first and last name.",
  BIRTH_DATE: "Enter a valid date of birth.",
  TOO_YOUNG: "Your child is younger than this school's minimum age for enrollment.",
  NOT_A_MINOR: "Adults enroll themselves on the school's page, with their own email.",
  CONSENT: "Check the box and type your full name to agree.",
  BUSY: "You already have several requests waiting for the school. Wait until it answers them.",
  INVALID: "Something in the form isn't valid. Reload the page and try again.",
};

const field = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);

export async function addChild(_prev: AddChildState, fd: FormData): Promise<AddChildState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ds_client_add_child", {
    p_session: (await lessonsSession()) ?? "",
    p: {
      first_name: field(fd, "first_name", 60),
      last_name: field(fd, "last_name", 60),
      birth_date: field(fd, "birth_date", 10),
      program_id: field(fd, "program_id", 40),
      branch_id: field(fd, "branch_id", 40),
      preferred_language: field(fd, "preferred_language", 2),
      message: field(fd, "message", 500),
      consent: fd.get("consent") === "on",
      consent_name: field(fd, "consent_name", 120),
    },
  });
  if (error) {
    const code = Object.keys(CHILD_MESSAGES).find((k) => error.message.includes(k));
    return { error: code ? CHILD_MESSAGES[code] : AppError.from(error).display(), done: false };
  }
  return { error: null, done: true };
}
