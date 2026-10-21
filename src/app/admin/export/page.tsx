import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { getBranchScope } from "@/lib/branch-scope";
import { ExportForm } from "./export-form";
import { requireFeature } from "@/lib/fleet-features";

// Converted to a server component (explicit user requirement, 2026-09-18)
// so the Growth gate can be checked BEFORE the form (and its download
// links straight to /api/admin/export/csv|pdf) ever renders -- the API
// routes already enforce this via lib/fleet-export.ts, but a Starter org
// used to see the raw Postgres FLEET_GROWTH_REQUIRED text only after
// clicking Download; now they see the real upsell up front. The
// interactive date-picker bits stay in export-form.tsx (a client
// component) since Server Components can't hold that state themselves.
export default async function ExportPage() {
  await requireFeature("fleet_export");
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const scope = await getBranchScope(orgId);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          {scope.current ? (
            <>
              Mileage <span className="text-muted">· {scope.current.name}</span>
            </>
          ) : (
            "Fleet-wide mileage"
          )}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          One export covering every driver in this range — a rollup, not
          each driver&apos;s full trip-by-trip detail (that&apos;s still
          available per-driver through the Report Portal).
        </p>
      </div>

      <ExportForm />
    </main>
  );
}
