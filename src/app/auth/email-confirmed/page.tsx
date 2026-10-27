import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { AcceptPendingInvite } from "./accept-pending-invite";

// Landing page for the "Confirm your signup" email (2026-10-01): the link
// used to fall back to the Supabase Site URL (localhost). The template now
// links to /auth/confirm?token_hash=...&type=email&next=/auth/email-confirmed,
// which verifies the token server-side and lands here. Works the same for
// app sign-ups (no PKCE verifier needed) and web sign-ups.
export default async function EmailConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (error) {
    return (
      <AuthShell
        title="This link has expired"
        subtitle="Confirmation links work once and expire after a while. Sign in with your email and password and we'll send you a new one."
      >
        <div className="space-y-3 text-sm">
          <Link
            href="/login"
            className="block w-full rounded-lg bg-accent px-4 py-2.5 text-center font-semibold text-accent-foreground transition hover:opacity-90"
          >
            Go to sign in
          </Link>
          <p className="text-muted">
            Signed up in the mobile app? Open ControlMiles on your phone and sign in there. Need help? Write to{" "}
            <a href="mailto:support@controlmiles.com" className="text-accent hover:underline">
              support@controlmiles.com
            </a>
            .
          </p>
        </div>
      </AuthShell>
    );
  }

  // Invited to a fleet and not accepted yet (the invite page could not finish because
  // the email had to be confirmed first): offer the last step here. If the database
  // function is not there or nobody is signed in, this page is exactly as before.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  let invite: { organization_name: string; intended_role: string } | null = null;
  if (auth.user) {
    const { data } = await supabase.rpc("my_pending_invite").maybeSingle();
    invite = (data as { organization_name: string; intended_role: string } | null) ?? null;
  }

  if (invite) {
    return (
      <AuthShell title="Email confirmed" subtitle="Your ControlMiles account is ready.">
        <div className="space-y-4 text-sm">
          <AcceptPendingInvite organizationName={invite.organization_name} role={invite.intended_role} />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Email confirmed" subtitle="Your ControlMiles account is ready.">
      <div className="space-y-4 text-sm">
        <p className="rounded-lg border border-border px-4 py-3">
          <strong>Signed up in the mobile app?</strong> Go back to ControlMiles on your phone and sign in with
          your email and password.
        </p>
        <Link
          href="/admin"
          className="block w-full rounded-lg bg-accent px-4 py-2.5 text-center font-semibold text-accent-foreground transition hover:opacity-90"
        >
          Continue on the web
        </Link>
      </div>
    </AuthShell>
  );
}
