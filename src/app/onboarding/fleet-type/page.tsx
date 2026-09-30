import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { AuthShell } from "@/components/auth-shell";
import { FleetTypeForm } from "./fleet-type-form";

// Onboarding step (explicit user request, 2026-09-30): one sign-up for
// every fleet; the company picks what kind of fleet it is HERE, after the
// account and organization exist -- not on the sign-up form.
// admin/layout.tsx sends an owner/admin here while their fleet's
// fleet_type_confirmed_at is empty.
export default async function FleetTypePage() {
  const { user, profile } = await getAuthedProfile();
  if (!user) redirect("/login");
  const orgId = profile?.default_org_id;
  if (!orgId) redirect("/admin");

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, fleet_type_confirmed_at")
    .eq("id", orgId)
    .maybeSingle();
  if (!org || org.fleet_type_confirmed_at) redirect("/admin");

  return (
    <AuthShell
      title="What kind of fleet is it?"
      subtitle={`${org.name} is almost ready. This turns on the tools that fit your business.`}
    >
      <FleetTypeForm />
    </AuthShell>
  );
}
