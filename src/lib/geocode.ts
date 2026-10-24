// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/geocode.ts
//
// Address search on the SERVER (2026-10-24), replacing the browser's calls to
// the public Photon service. What the licences and policies we read allow:
//
//  * U.S. Census Bureau Geocoder (geocoding.geo.census.gov): free, no key, US
//    addresses only (street number + street), results are interpolated along
//    the address range, no CORS (so server only), no published usage terms,
//    SLA or commercial clause: treat it as best effort and keep a fallback.
//  * OpenStreetMap Nominatim: at most 1 request per second for the whole app,
//    an identifying User-Agent/Referer, results cached, NO autocomplete, and
//    "do not submit personal data or other confidential material".
//
// So: a student's HOME address (personal data of a minor) goes ONLY to the
// Census geocoder, never to Nominatim, and is never cached here. Schools and
// other places (not personal) try the cache, then the Census, then Nominatim.

import type { SupabaseClient } from "@supabase/supabase-js";

export type GeoKind = "personal" | "place";
export type GeoResult = { address: string; lat: number; lon: number };

const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "ControlMiles/1.0 (https://controlmiles.com; info@controlmiles.com)";
const CACHE_DAYS = 30;

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    // State abbreviations stay in capitals: "Baltimore, Md, 21211" -> "MD".
    .replace(/,\s*([A-Za-z]{2}),/g, (_, st: string) => `, ${st.toUpperCase()},`);

export const normalizeQuery = (q: string) => q.trim().replace(/\s+/g, " ").toLowerCase();

export async function censusGeocode(query: string): Promise<GeoResult[]> {
  const url = `${CENSUS_URL}?address=${encodeURIComponent(query)}&benchmark=Public_AR_Current&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(7000), cache: "no-store" });
  if (!res.ok) throw new Error(`census geocoder ${res.status}`);
  const body = (await res.json()) as {
    result?: { addressMatches?: { matchedAddress: string; coordinates: { x: number; y: number } }[] };
  };
  return (body.result?.addressMatches ?? []).slice(0, 5).map((m) => ({
    address: titleCase(m.matchedAddress),
    lat: m.coordinates.y,
    lon: m.coordinates.x,
  }));
}

// Best-effort 1 request per second on this server instance; the policy limit
// is for the whole application, so volumes here must stay small.
let lastNominatim = 0;
export async function nominatimGeocode(query: string): Promise<GeoResult[]> {
  const wait = lastNominatim + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=jsonv2&limit=5&countrycodes=us`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Referer: "https://controlmiles.com", "Accept-Language": "en" },
    signal: AbortSignal.timeout(7000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return rows.map((r) => ({ address: r.display_name.replace(/, United States$/, ""), lat: Number(r.lat), lon: Number(r.lon) }));
}

/** Looks an address up. Never throws: a failing provider just yields fewer results. */
export async function geocode(
  db: SupabaseClient,
  orgId: string,
  query: string,
  kind: GeoKind,
): Promise<{ results: GeoResult[]; provider: "census" | "nominatim" | "cache" | null }> {
  const q = query.trim().replace(/\s+/g, " ");
  if (q.length < 5 || q.length > 200) return { results: [], provider: null };

  if (kind === "place") {
    const key = normalizeQuery(q);
    const { data } = await db
      .from("geocode_cache")
      .select("label, latitude, longitude, created_at")
      .eq("organization_id", orgId)
      .eq("query_norm", key)
      .maybeSingle();
    if (data && Date.now() - new Date(data.created_at).getTime() < CACHE_DAYS * 86_400_000) {
      return { results: [{ address: data.label, lat: data.latitude, lon: data.longitude }], provider: "cache" };
    }
  }

  let results: GeoResult[] = [];
  let provider: "census" | "nominatim" | null = null;
  try {
    results = await censusGeocode(q);
    if (results.length) provider = "census";
  } catch {
    // Census down or slow: for places we still have Nominatim.
  }
  if (!results.length && kind === "place") {
    try {
      results = await nominatimGeocode(q);
      if (results.length) provider = "nominatim";
    } catch {
      results = [];
    }
  }

  // Only an unambiguous answer is cached: a list of candidates is for a person to choose from.
  if (kind === "place" && results.length === 1 && provider) {
    await db.from("geocode_cache").upsert({
      organization_id: orgId,
      query_norm: normalizeQuery(q),
      label: results[0].address.slice(0, 240),
      latitude: results[0].lat,
      longitude: results[0].lon,
      provider,
      created_at: new Date().toISOString(),
    });
  }
  return { results, provider };
}
