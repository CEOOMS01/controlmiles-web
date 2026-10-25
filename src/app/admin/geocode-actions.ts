"use server";

// Address search for the panel's address fields (see src/lib/geocode.ts for
// which service may receive what). Signed-in operators and above only; the
// browser never talks to a geocoder itself.

import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { geocode, type GeoKind, type GeoResult } from "@/lib/geocode";

export type AddressSearch = { results: GeoResult[]; error: string | null; note?: string };

export async function searchAddress(query: string, kind: GeoKind): Promise<AddressSearch> {
  const { user, profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!user || !orgId) return { results: [], error: "Not signed in." };
  const q = String(query ?? "").trim();
  if (q.length < 5) return { results: [], error: "Type the street number, street and city." };
  if (q.length > 200) return { results: [], error: "That address is too long." };
  const supabase = await createClient();
  const { results, unavailable, cityMismatch } = await geocode(supabase, orgId, q, kind === "personal" ? "personal" : "place");
  if (unavailable) return { results: [], error: "The address lookup is not available right now. Try again in a few minutes." };
  return {
    results,
    error: null,
    note: cityMismatch ? "None of these is in the city you typed. Pick the right one, or leave the city out." : undefined,
  };
}
