import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { GrowthUpsell } from "../growth-upsell";
import { ExportForm } from "./export-form";

// Converted to a server component (explicit user requirement, 2026-09-18)
// so the Growth gate can be checked BEFORE the form (and its download
// links straight to /api/admin/export/csv|pdf) ever renders -- the API
// routes already enforce this via lib/fleet-export.ts, but a Starter org
// used to see the raw Postgres FLEET_GROWTH_REQUIRED text only after
// clicking Download; now they see the real upsell up front. The
// interactive date-picker bits stay in export-form.tsx (a client
// component) since Server Components can't hold that state themselves.
export default async function ExportPage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const { data: tier } = await supabase.rpc("fn_org_effective_tier", { p_org_id: orgId });
  const isGrowth = tier === "growth" || tier === "enterprise";

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          Export
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Fleet-wide mileage</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          One export covering every driver in this range — a rollup, not
          each driver&apos;s full trip-by-trip detail (that&apos;s still
          available per-driver through the Report Portal).
        </p>
      </div>

      {isGrowth ? <ExportForm /> : <GrowthUpsell feature="Fleet-wide export" />}
    </main>
  );
}
