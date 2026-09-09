import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { RenameOrgForm } from "./rename-org-form";
import { VehicleAssignmentModeForm } from "./vehicle-assignment-mode-form";
import { DeleteOrgForm } from "./delete-org-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("name, compliance_mode, created_at, vehicle_assignment_mode")
    .eq("id", orgId)
    .maybeSingle();

  if (!org) return null;

  const createdDate = org.created_at
    ? new Date(org.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          Settings
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{org.name}</h1>
      </div>

      <div className="max-w-2xl space-y-10">
        <SettingsSection
          title="General"
          description="Your fleet's identity across the app and reports."
        >
          <RenameOrgForm orgId={orgId} currentName={org.name} />
          {createdDate && (
            <p className="mt-4 text-xs text-muted">Fleet created {createdDate}.</p>
          )}
        </SettingsSection>

        <SettingsSection
          title="Fleet operations"
          description="How drivers and vehicles work day to day."
        >
          <VehicleAssignmentModeForm
            orgId={orgId}
            currentMode={org.vehicle_assignment_mode === "open" ? "open" : "fixed"}
          />
        </SettingsSection>

        <SettingsSection
          title="Immutability"
          description="What's permanent by design, not just by convention."
        >
          <div className="rounded-xl border border-border bg-surface p-5">
            <ul className="space-y-1.5 text-sm text-muted">
              <li>• Driver and vehicle IDs (CM-D#### / CM-T####) — permanent once assigned</li>
              <li>• Miles and duration on a closed trip — locked once saved and closed</li>
              <li>• A closed route — locked once dispatched and completed</li>
            </ul>
            <p className="mt-3 text-xs text-muted">
              Enforced at the database level, not just hidden in this UI —
              they can&apos;t be edited from anywhere, including direct
              API access.
            </p>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Danger zone"
          description="Irreversible, org-wide actions."
          accent
        >
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-5">
            <DeleteOrgForm orgId={orgId} orgName={org.name} />
          </div>
        </SettingsSection>
      </div>
    </main>
  );
}

function SettingsSection({
  title,
  description,
  accent,
  children,
}: {
  title: string;
  description: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className={`text-sm font-semibold ${accent ? "text-danger" : ""}`}>{title}</h2>
      <p className="mt-0.5 text-xs text-muted">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
