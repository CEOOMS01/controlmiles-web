import { getAuthedProfile } from "@/lib/supabase/org-context";
import { CsvImporter } from "./csv-importer";

export default async function ImportPage() {
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Import</p>
        <h1 className="mt-1 text-2xl font-semibold">Bulk import</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Add many vehicles or drivers at once from a CSV file — for onboarding a fleet moving over
          from another provider, instead of adding each one by hand.
        </p>
      </div>

      <CsvImporter orgId={orgId} />
    </main>
  );
}
