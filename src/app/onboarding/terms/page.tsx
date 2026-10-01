import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth-shell";
import { TermsForm } from "./terms-form";
import { LEGAL_TERMS_VERSION } from "@/lib/legal-version";

// One-time gate (2026-09-29): accounts that reached the dashboard without
// confirming 18+ and the Terms -- Google sign-ups, and anyone from before
// this was recorded -- confirm here once; admin/layout.tsx sends them.
export default async function AcceptTermsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("legal_accepted_at, legal_terms_version")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.legal_accepted_at && profile.legal_terms_version === LEGAL_TERMS_VERSION) redirect("/admin");
  // Accepted an older version: the Terms changed materially since.
  const isUpdate = !!profile?.legal_accepted_at;

  return (
    <AuthShell
      title={isUpdate ? "We updated our Terms" : "One quick confirmation"}
      subtitle={
        isUpdate
          ? `You're signed in as ${user.email}. Our Terms of Service and Privacy Policy changed on October 1, 2026 (maps, live location, fuel, IFTA, safety scores, billing). Please review and accept them to continue.`
          : `You're signed in as ${user.email}. ControlMiles is for adults: please confirm before continuing.`
      }
    >
      <TermsForm />
    </AuthShell>
  );
}
