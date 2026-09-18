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
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/reset-password";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/forgot-password?expired=1");
}
