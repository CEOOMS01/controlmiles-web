import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Standard Supabase Auth email-link landing route: the default "Reset
// Password" template Supabase sends links to
// `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}`
// -- this exchanges that one-time token_hash for a real (recovery)
// session via verifyOtp, writing the session cookie through the same
// server client every other route uses, then hands off to `next`
// (reset-password/page.tsx actually sets the new password). A failed or
// already-used link falls back to forgot-password with a flag the page
// reads to show a real "request a new one" message instead of a dead end.
//
// Explicit user request (2026-09-18, "flujo de iniciar sesión con tu
// cuenta de Google"): this route also doubles as the OAuth callback --
// Google redirects the browser back here with `?code=...` (PKCE), not
// `token_hash`/`type`. exchangeCodeForSession turns that into a real
// session the same way verifyOtp does for the email-link case. After a
// successful Google sign-in, mirrors login/actions.ts's own
// admin-vs-app-required redirect exactly (same organization_members
// owner/admin check) -- that logic only runs there today because
// password sign-in resolves inside a Server Action; OAuth resolves here
// instead, so the same authorization decision has to be duplicated at
// this second entry point, not skipped.
//
// Explicit user follow-up (2026-09-18): "primero se loguea y luego crea
// la organización paso a paso" -- a brand-new Google sign-in has no org
// yet (no pending_org_name the way password /signup carries one), but
// unlike a genuine non-admin mobile-app account, this person just
// authenticated through the FLEET-ADMIN-ONLY website, so the org-less
// case here means "new fleet admin, hasn't named their fleet yet", not
// "wrong audience, go get the mobile app". Sends them to
// /onboarding/organization instead of /app-required -- that page itself
// re-checks both conditions (real session, still no org) before
// rendering anything.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/reset-password";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(next);
    }
    redirect("/forgot-password?expired=1");
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const { data: adminMemberships } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", data.user.id)
        .in("member_role", ["owner", "admin"])
        .eq("is_active", true)
        .limit(1);
      redirect((adminMemberships?.length ?? 0) > 0 ? "/admin" : "/onboarding/organization");
    }
    redirect("/login?oauth_error=1");
  }

  redirect("/forgot-password?expired=1");
}
