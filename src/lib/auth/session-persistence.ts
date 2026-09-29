// "Keep me signed in" (2026-09-29). Researched first: Microsoft's KMSI sets
// a persistent auth cookie (up to 90 days) when chosen and a browser-session
// cookie otherwise; OWASP: never store the password, only revocable tokens.
//
// The choice itself lives in a small, non-secret preference cookie written
// by the login page's checkbox, so it applies to both the email and the
// Google sign-in paths and to every later token refresh (middleware).
// Off by default on the web: fleet dashboards are often opened on shared
// office computers.

import type { CookieOptions } from "@supabase/ssr";

export const STAY_SIGNED_IN_COOKIE = "cm_stay_signed_in";
const PERSISTENT_MAX_AGE = 60 * 60 * 24 * 90; // 90 days, like Microsoft KMSI

export function staySignedInFrom(value: string | undefined): boolean {
  return value === "1";
}

/** Auth-cookie options under the chosen persistence. */
export function authCookieOptions(options: CookieOptions, staySignedIn: boolean): CookieOptions {
  const rest: CookieOptions = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return {
    ...rest,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // No maxAge/expires = a browser-session cookie, gone when it closes.
    ...(staySignedIn ? { maxAge: PERSISTENT_MAX_AGE } : {}),
  };
}
