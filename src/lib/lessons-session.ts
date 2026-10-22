// Driving school client portal session (2026-10-22). The sign-in link from
// the email (ds-portal-access) becomes a 30-day session in the database
// (ds_client_open_link); the browser keeps only its token, in an httpOnly
// cookie scoped to /lessons, so page scripts never see it.

import { cookies } from "next/headers";

export const LESSONS_COOKIE = "cm_lessons";
export const LESSONS_MAX_AGE = 30 * 24 * 60 * 60;

/** The session token, or null. Shape-checked before it reaches the database. */
export async function lessonsSession(): Promise<string | null> {
  const value = (await cookies()).get(LESSONS_COOKIE)?.value ?? "";
  return /^[0-9a-f]{64}$/.test(value) ? value : null;
}
