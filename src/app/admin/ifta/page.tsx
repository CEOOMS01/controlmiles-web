import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { IftaReport } from "./ifta-report";

export default async function IftaPage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, nickname, make, model, year")
    .eq("organization_id", orgId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          IFTA
        </p>
        <h1 className="mt-1 text-2xl font-semibold">State mileage</h1>
      </div>

      <IftaReport orgId={orgId} vehicles={vehicles ?? []} />
    </main>
  );
}
