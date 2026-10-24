// School route builder (2026-10-24): create a route end to end on one page,
// with a map. See route-builder.tsx.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { loadCrewOptions } from "@/lib/school-crew";
import { requireFeature } from "@/lib/fleet-features";
import { RouteBuilder } from "./route-builder";

export default async function NewSchoolRoutePage() {
  await requireFeature("school");
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!user || !orgId) return null;

  const [{ data: schools }, crew, { data: me }] = await Promise.all([
    supabase.from("school_sites").select("id, name, address, latitude, longitude").eq("organization_id", orgId).order("name"),
    loadCrewOptions(supabase, orgId),
    supabase.from("profiles").select("time_format").eq("id", user.id).maybeSingle(),
  ]);

  const firstSchool = (schools ?? []).find((s) => s.latitude != null && s.longitude != null);
  // Open on the first school; without one, the whole country until the first stop.
  const center: [number, number] = firstSchool ? [firstSchool.longitude, firstSchool.latitude] : [-98.5795, 39.8283];
  const zoom = firstSchool ? 12 : 3.5;

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-7 sm:px-8 lg:py-8">
      <Link href="/admin/school/routes" className="text-sm text-muted hover:text-accent">
        ← School routes
      </Link>
      <h1 className="mt-1 text-xl font-semibold tracking-tight">New school route</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Details, crew and stops on the map, then save it as a draft or publish it to the drivers.
      </p>
      <RouteBuilder
        schools={(schools ?? []).map((s) => ({
          id: s.id,
          label: s.name,
          lat: s.latitude,
          lng: s.longitude,
          address: s.address,
        }))}
        drivers={crew.drivers}
        monitors={crew.monitors}
        vehicles={crew.vehicles}
        timeFormat={me?.time_format === "24h" ? "24h" : "12h"}
        center={center}
        zoom={zoom}
      />
    </main>
  );
}
