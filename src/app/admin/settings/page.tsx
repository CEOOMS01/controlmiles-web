import { createClient } from "@/lib/supabase/server";
import { RenameOrgForm } from "./rename-org-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_org_id")
    .eq("id", user.id)
    .maybeSingle();
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("name, compliance_mode, created_at")
    .eq("id", orgId)
    .maybeSingle();

  if (!org) return null;

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          Settings
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Organization</h1>
      </div>

      <div className="max-w-xl">
        <RenameOrgForm orgId={orgId} currentName={org.name} />

        <div className="mt-8 rounded-xl border border-border bg-surface p-5">
          <p className="text-sm font-semibold">What can&apos;t be changed here</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>• Driver and vehicle IDs (CM-D#### / CM-T####) — permanent once assigned</li>
            <li>• Miles and duration on a closed trip — locked once saved and closed</li>
            <li>• A closed route — locked once dispatched and completed</li>
          </ul>
          <p className="mt-3 text-xs text-muted">
            These are enforced at the database level, not just hidden in
            this UI — they can&apos;t be edited from anywhere, including
            direct API access.
          </p>
        </div>
      </div>
    </main>
  );
}
