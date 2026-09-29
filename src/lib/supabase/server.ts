import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { STAY_SIGNED_IN_COOKIE, authCookieOptions, staySignedInFrom } from "@/lib/auth/session-persistence";

export async function createClient() {
  const cookieStore = await cookies();
  const staySignedIn = staySignedInFrom(cookieStore.get(STAY_SIGNED_IN_COOKIE)?.value);

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, authCookieOptions(options, staySignedIn)),
            );
          } catch {
            // Called from a Server Component with no request context to
            // write to -- safe to ignore as long as middleware also
            // refreshes the session (it does, see middleware.ts).
          }
        },
      },
    },
  );
}
