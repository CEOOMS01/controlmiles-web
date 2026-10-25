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
//  * OUR OWN geocoder (GEOCODER_URL, a Cloudflare Worker over U.S. Census
//    TIGER/Line address ranges, public domain; see controlmiles-backend
//    infra/cloudflare/geocoder-worker.js): no third party sees the address, no
//    terms to depend on. It covers the states whose data file is loaded; for
//    any other state it answers covered=false and we fall back as below.
//
// So: a student's HOME address (personal data of a minor) goes to our own
// geocoder first; ONLY when it does not cover that state does it go to the
// Census geocoder, never to Nominatim, and it is never cached here. Schools and
// other places (not personal) try the cache, our own geocoder, the Census, then
// Nominatim.

import type { SupabaseClient } from "@supabase/supabase-js";

export type GeoKind = "personal" | "place";

/** Our own geocoder. null = not configured / unreachable; covered=false = state not loaded. */
export async function ownGeocode(
  query: string,
): Promise<{ covered: boolean; results: GeoResult[]; notAddress: boolean; cityMatch: boolean } | null> {
  const url = process.env.GEOCODER_URL;
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.GEOCODER_KEY ? { "X-CM-Key": process.env.GEOCODER_KEY } : {}) },
      // POST body, not the URL: URLs are logged and this can be a child's home.
      body: JSON.stringify({ q: query }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      covered?: boolean;
      note?: string;
      cityMatch?: boolean;
      results?: { address: string; lat: number; lon: number }[];
    };
    return {
      covered: body.covered !== false,
      notAddress: body.note === "not a street address",
      cityMatch: body.cityMatch !== false,
      results: (body.results ?? []).map((r) => ({ address: r.address, lat: r.lat, lon: r.lon })),
    };
  } catch {
    return null;
  }
}
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

/**
 * Geoapify (free plan: 3,000 credits a day, commercial use allowed with
 * attribution). Only for non-personal places: it keeps the request body for up
 * to 24 hours on EU servers and its terms say nothing about children's data.
 */
export async function geoapifyGeocode(query: string): Promise<GeoResult[]> {
  const key = process.env.GEOAPIFY_KEY;
  if (!key) throw new Error("no geoapify key");
  const url =
    "https://api.geoapify.com/v1/geocode/search?format=json&limit=5&filter=countrycode:us&text=" +
    encodeURIComponent(query) +
    "&apiKey=" +
    encodeURIComponent(key);
  const res = await fetch(url, { signal: AbortSignal.timeout(7000), cache: "no-store" });
  if (!res.ok) throw new Error(`geoapify ${res.status}`);
  const body = (await res.json()) as { results?: { formatted?: string; lat: number; lon: number }[] };
  return (body.results ?? []).map((r) => ({ address: (r.formatted ?? "").replace(/, United States of America$/, ""), lat: r.lat, lon: r.lon }));
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
): Promise<{
  results: GeoResult[];
  provider: "own" | "census" | "nominatim" | "geoapify" | "cache" | null;
  unavailable?: boolean;
  /** The street exists, but not in the city that was typed: a person must choose. */
  cityMismatch?: boolean;
}> {
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

  // Our own geocoder first. Where it covers the state its answer is final: an
  // address it cannot place is not forwarded to anyone else. A place name that
  // is not a street address ("Lincoln Elementary") may still go on to the
  // public providers, but only for non-personal places.
  const own = await ownGeocode(q);
  if (own?.covered && (own.results.length > 0 || kind === "personal" || !own.notAddress)) {
    return { results: own.results, provider: own.results.length ? "own" : null, cityMismatch: own.results.length > 0 && !own.cityMatch };
  }

  // A home address never goes to anyone else once our own geocoder is set up:
  // if it is configured but unreachable, say so instead of sending it elsewhere.
  if (kind === "personal" && process.env.GEOCODER_URL && own === null) {
    return { results: [], provider: null, unavailable: true };
  }

  let results: GeoResult[] = [];
  let provider: "census" | "nominatim" | "geoapify" | null = null;
  try {
    results = await censusGeocode(q);
    if (results.length) provider = "census";
  } catch {
    // Census down or slow: for places we still have the others.
  }
  if (!results.length && kind === "place") {
    try {
      if (process.env.GEOAPIFY_KEY) {
        results = await geoapifyGeocode(q);
        if (results.length) provider = "geoapify";
      } else {
        results = await nominatimGeocode(q);
        if (results.length) provider = "nominatim";
      }
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
