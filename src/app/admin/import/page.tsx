import { getAuthedProfile } from "@/lib/supabase/org-context";
import { CsvImporter } from "./csv-importer";

export default async function ImportPage() {
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Bulk import</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Add many vehicles or drivers at once from a CSV file — for onboarding a fleet moving over
          from another provider, instead of adding each one by hand.
        </p>
      </div>

      <CsvImporter orgId={orgId} />
    </main>
  );
}
