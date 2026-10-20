import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { RenameOrgForm } from "./rename-org-form";
import { VehicleAssignmentModeForm } from "./vehicle-assignment-mode-form";
import { OwnerOperatorForm } from "./owner-operator-form";
import { isFleetProfile } from "@/lib/fleet-profiles";
import { getOrgFeatures } from "@/lib/fleet-features";
import { getBranchScope } from "@/lib/branch-scope";
import { BranchesManager } from "../branch-controls";
import { ScheduleSettingsForm } from "./schedule-settings-form";
import { FleetTypeRow, ModuleOptionsForm } from "./industry-template-form";
import { SettingsSection, SettingsTabs } from "@/components/settings-ui";
import { DeleteOrgForm } from "./delete-org-form";
import { BillingSection } from "./billing-section";
import { TimeFormatForm } from "./time-format-form";

const TABS = [
  { id: "general", label: "General" },
  { id: "operations", label: "Operations" },
  { id: "branches", label: "Branches" },
  { id: "billing", label: "Billing" },
  { id: "preferences", label: "Preferences" },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; billing?: string }>;
}) {
  const sp = await searchParams;
  // Stripe returns with ?billing=, so that lands on Billing.
  const tab = TABS.some((t) => t.id === sp.tab) ? sp.tab! : sp.billing ? "billing" : "general";
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const [{ data: org }, { count: vehicleCount }, { data: myProfile }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "name, compliance_mode, created_at, vehicle_assignment_mode, subscription_tier, subscription_status, subscription_vehicle_count, fleet_type_confirmed_at, timezone, shift_start_window_minutes, industry_template, allow_driver_owned_vehicles, require_pretrip_inspection, use_shift_schedules",
      )
      .eq("id", orgId)
      .maybeSingle(),
    supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("is_archived", false),
    supabase.from("profiles").select("time_format").eq("id", user.id).maybeSingle(),
  ]);

  if (!org) return null;
  const branchScope = await getBranchScope(orgId);
  // Driving schools: branches per plan (fn_org_branch_allowance, 2026-10-20).
  const { data: allowanceRows } =
    tab === "branches" ? await supabase.rpc("fn_org_branch_allowance", { p_org: orgId }) : { data: null };
  const allowance = (Array.isArray(allowanceRows) ? allowanceRows[0] : null) as
    | { included: number | null; max_branches: number | null; extra_price_cents: number | null; active: number }
    | null;
  const features = await getOrgFeatures(orgId);

  const createdDate = org.created_at
    ? new Date(org.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // Settings layout (redesign 2026-10-20): vertical tabs, one section per
  // page, open sections (heading, help, rows divided by thin lines) instead
  // of boxed cards; the danger zone sits apart at the end of General.
  return (
    <main className="px-6 py-10 sm:px-10">
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">Settings</p>
      <h1 className="mt-1 text-2xl font-semibold">{org.name}</h1>

      <div className="mt-8 flex max-w-5xl flex-col gap-8 lg:flex-row lg:gap-12">
        <SettingsTabs base="/admin/settings" current={tab} tabs={TABS} />

        <div className="min-w-0 flex-1 space-y-8">
          {tab === "general" && (
            <>
              <SettingsSection title="General" help="Your fleet's name and type.">
                <div className="divide-y divide-border border-y border-border">
                  <RenameOrgForm orgId={orgId} currentName={org.name} />
                  <FleetTypeRow
                    orgName={org.name}
                    confirmedAt={org.fleet_type_confirmed_at ?? null}
                    current={isFleetProfile(org.industry_template) ? org.industry_template : "general"}
                  />
                </div>
                <p className="mt-3 text-xs text-muted">
                  {createdDate ? `Created ${createdDate}. ` : ""}Driver and vehicle IDs and the miles of a closed trip
                  are locked by design and can&apos;t be edited from anywhere.
                </p>
              </SettingsSection>

              <SettingsSection title="Danger zone" help="Permanent and for the whole organization." danger>
                <DeleteOrgForm orgId={orgId} orgName={org.name} />
              </SettingsSection>
            </>
          )}

          {tab === "operations" && (
            <SettingsSection title="Operations" help="How drivers and vehicles work day to day.">
              <div className="divide-y divide-border border-y border-border">
                <ModuleOptionsForm
                  orgId={orgId}
                  requirePretrip={org.require_pretrip_inspection !== false}
                  useShifts={org.use_shift_schedules === true}
                  canUseShifts={features.has("shift_schedules")}
                />
                {features.has("open_assignment") && (
                  <VehicleAssignmentModeForm
                    orgId={orgId}
                    currentMode={org.vehicle_assignment_mode === "open" ? "open" : "fixed"}
                  />
                )}
                {features.has("owner_operators") && (
                  <OwnerOperatorForm orgId={orgId} allowed={org.allow_driver_owned_vehicles === true} />
                )}
                <ScheduleSettingsForm
                  orgId={orgId}
                  timezone={org.timezone ?? "America/New_York"}
                  windowMinutes={org.shift_start_window_minutes ?? 10}
                  showClassWindow={features.has("classes")}
                />
              </div>
            </SettingsSection>
          )}

          {tab === "branches" && (
            <SettingsSection
              title="Branches"
              help="Your locations (each office or yard). Put vehicles and drivers in a branch on the Team page and filter the dashboard by branch."
            >
              <BranchesManager
                branches={branchScope.branches}
                allowance={allowance?.max_branches != null ? allowance : null}
              />
            </SettingsSection>
          )}

          {tab === "billing" && (
            <SettingsSection title="Billing" help="Plans are per vehicle, billed monthly through Stripe.">
              <BillingSection
                orgId={orgId}
                vehicleCount={vehicleCount ?? 0}
                currentTier={
                  org.subscription_tier === "growth" || org.subscription_tier === "starter" || org.subscription_tier === "enterprise"
                    ? org.subscription_tier
                    : null
                }
                showEnterprise={org.industry_template === "driving_school"}
                schoolBranches={org.industry_template === "driving_school" ? branchScope.branches.length : null}
                currentStatus={org.subscription_status}
                billedVehicles={org.subscription_vehicle_count ?? null}
              />
            </SettingsSection>
          )}

          {tab === "preferences" && (
            <SettingsSection title="Preferences" help="Only for your account, not the rest of your team.">
              <div className="divide-y divide-border border-y border-border">
                <TimeFormatForm currentFormat={myProfile?.time_format === "24h" ? "24h" : "12h"} />
              </div>
            </SettingsSection>
          )}

          <p className="pt-4 text-xs text-muted">
            Ideas or something not working? Write to{" "}
            <a href="mailto:suggestions@controlmiles.com" className="text-accent hover:underline">
              suggestions@controlmiles.com
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
