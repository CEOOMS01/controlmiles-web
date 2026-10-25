"use server";

// Address search for the panel's address fields (see src/lib/geocode.ts for
// which service may receive what). Signed-in operators and above only; the
// browser never talks to a geocoder itself.

import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { geocode, type GeoKind, type GeoResult } from "@/lib/geocode";

export type AddressSearch = { results: GeoResult[]; error: string | null; note?: string };

// The state most of the organization's saved student addresses are in ("..., MD
// 21211" -> MD): searching one state is ~15x faster than all fifty. Cached a
// few minutes per server instance.
const stateHints = new Map<string, { st: string | null; at: number }>();
async function orgStateHint(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<string | null> {
  const hit = stateHints.get(orgId);
  if (hit && Date.now() - hit.at < 600_000) return hit.st;
  const { data } = await supabase
    .from("students")
    .select("home_address")
    .eq("organization_id", orgId)
    .not("home_address", "is", null)
    .limit(60);
  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const m = /,\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$/.exec(String(r.home_address ?? ""));
    if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  const st = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  stateHints.set(orgId, { st, at: Date.now() });
  return st;
}

export async function searchAddress(query: string, kind: GeoKind): Promise<AddressSearch> {
  const { user, profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!user || !orgId) return { results: [], error: "Not signed in." };
  const q = String(query ?? "").trim();
  if (q.length < 5) return { results: [], error: "Type the street number, street and city." };
  if (q.length > 200) return { results: [], error: "That address is too long." };
  const supabase = await createClient();
  const hint = await orgStateHint(supabase, orgId);
  const { results, unavailable, cityMismatch } = await geocode(supabase, orgId, q, kind === "personal" ? "personal" : "place", hint);
  if (unavailable) return { results: [], error: "The address lookup is not available right now. Try again in a few minutes." };
  return {
    results,
    error: null,
    note: cityMismatch ? "None of these is in the city you typed. Pick the right one, or leave the city out." : undefined,
  };
}
