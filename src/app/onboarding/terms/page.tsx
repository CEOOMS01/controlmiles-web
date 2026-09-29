import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth-shell";
import { TermsForm } from "./terms-form";

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
    .select("legal_accepted_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.legal_accepted_at) redirect("/admin");

  return (
    <AuthShell
      title="One quick confirmation"
      subtitle={`You're signed in as ${user.email}. ControlMiles is for adults: please confirm before continuing.`}
    >
      <TermsForm />
    </AuthShell>
  );
}
