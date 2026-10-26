// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/map-base.ts
//
// The ONE basemap every web map uses (2026-10-25): MapLibre GL JS reading our
// own Protomaps (OSM-derived) PMTiles file, served from our Cloudflare Worker
// (infra/cloudflare/tiles-worker.js in controlmiles-backend). No third-party
// tile server is touched at runtime, so there is no usage policy to break and
// no per-tile bill. It used to be copied into fleet-map-inner.tsx and
// geofence-map-inner.tsx, while the report portal still pulled raw tiles from
// tile.openstreetmap.org (whose policy forbids heavy commercial use).
//
// Client only: MapLibre touches `window` at import time, so import this from
// the `*-inner.tsx` files that are dynamic-imported with ssr:false.
//
// NEXT_PUBLIC_FLEET_MAP_PMTILES_URL points at the .pmtiles file; without it
// the Protomaps demo tile (a small sample area, NOT for production) is used so
// local dev never hard-fails.

import * as maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";

export const PMTILES_URL =
  process.env.NEXT_PUBLIC_FLEET_MAP_PMTILES_URL ?? "https://demo-bucket.protomaps.com/v4.pmtiles";

// addProtocol is a global MapLibre registration: once per page load, not per map.
let protocolRegistered = false;
export function ensurePmtilesProtocol() {
  if (protocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  protocolRegistered = true;
}

export function buildStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/light",
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${PMTILES_URL}`,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    },
    layers: layers("protomaps", namedFlavor("light"), { lang: "en" }),
  };
}
