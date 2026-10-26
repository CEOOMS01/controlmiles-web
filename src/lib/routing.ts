// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/routing.ts
//
// Road path and leg times for a school route (2026-10-25), from OUR OWN routing
// server (Valhalla, see controlmiles-backend infra/valhalla). The stops are
// children's homes, so this never goes to a third-party router: ROUTING_URL is
// ours, the request body (coordinates) is a POST (never in a URL or a log), and
// ROUTING_KEY is the shared secret our reverse proxy checks. Not configured, or
// unreachable, means "no road path": the map then just shows the stop pins.
//
// Called once when a route's stops are saved, never on a page view.

import { createHash } from "node:crypto";

export type RoutePoint = { lat: number; lon: number };

export type RoadPath = {
  /** Valhalla polyline6 of the whole path, stops in order. */
  polyline: string;
  distanceM: number;
  durationS: number;
  /** One per leg: from stop i to stop i+1 (so one fewer than the points). */
  legs: { distanceM: number; durationS: number }[];
};

/** Hash of the stops (order and coordinates): tells when a stored path is stale. */
export function pathSignature(points: RoutePoint[]): string {
  const s = points.map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join("|");
  return createHash("sha1").update(s).digest("hex").slice(0, 16);
}

type ValhallaRoute = {
  trip?: {
    legs?: { shape?: string; summary?: { time?: number; length?: number } }[];
    summary?: { time?: number; length?: number };
  };
};

/**
 * The road path through the points in order, or null when the server is not
 * configured, cannot route (a point far from any road) or does not answer.
 */
export async function routeThrough(points: RoutePoint[]): Promise<RoadPath | null> {
  const base = process.env.ROUTING_URL;
  if (!base || points.length < 2) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.ROUTING_KEY ? { "X-CM-Key": process.env.ROUTING_KEY } : {}) },
      body: JSON.stringify({
        locations: points.map((p) => ({ lat: p.lat, lon: p.lon, type: "break" })),
        // A school bus: Valhalla's bus costing (roads a bus may use).
        costing: "bus",
        directions_type: "none",
        units: "kilometers",
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as ValhallaRoute;
    const legs = body.trip?.legs ?? [];
    if (legs.length !== points.length - 1 || legs.some((l) => !l.shape)) return null;
    // Join the legs' shapes (each starts where the previous one ended).
    const coords: [number, number][] = [];
    legs.forEach((l, i) => {
      const part = decodePolyline6(l.shape as string);
      coords.push(...(i === 0 ? part : part.slice(1)));
    });
    return {
      polyline: encodePolyline6(coords),
      distanceM: Math.round((body.trip?.summary?.length ?? 0) * 1000),
      durationS: Math.round(body.trip?.summary?.time ?? 0),
      legs: legs.map((l) => ({
        distanceM: Math.round((l.summary?.length ?? 0) * 1000),
        durationS: Math.round(l.summary?.time ?? 0),
      })),
    };
  } catch {
    return null;
  }
}

// --- polyline6 (Valhalla's encoding: Google's algorithm at 1e-6 precision) ---

/** Decodes a polyline6 string into [lng, lat] pairs (the order MapLibre wants). */
export function decodePolyline6(str: string): [number, number][] {
  const out: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    for (const axis of [0, 1]) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index <= str.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    out.push([lng / 1e6, lat / 1e6]);
  }
  return out;
}

/** Encodes [lng, lat] pairs as polyline6. */
export function encodePolyline6(coords: [number, number][]): string {
  let prevLat = 0;
  let prevLng = 0;
  let out = "";
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return s + String.fromCharCode(n + 63);
  };
  for (const [lng, lat] of coords) {
    const la = Math.round(lat * 1e6);
    const lo = Math.round(lng * 1e6);
    out += enc(la - prevLat) + enc(lo - prevLng);
    prevLat = la;
    prevLng = lo;
  }
  return out;
}
