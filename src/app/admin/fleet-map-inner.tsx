"use client";

// Olympus Mont Systems LLC - ControlMiles
// src/app/admin/fleet-map-inner.tsx
//
// BUG FIX / real cost & policy risk closed (2026-09-21, explicit user
// request): this used to hit tile.openstreetmap.org directly (raw
// react-leaflet TileLayer) -- OSM's own Tile Usage Policy prohibits heavy
// commercial use of that free server and reserves the right to block
// without notice, flagged as a real risk earlier this session. Replaced
// with MapLibre GL JS (BSD-3-Clause, genuinely free, no vendor lock)
// reading a self-hosted PMTiles file (own OSM-derived basemap, own
// storage, own domain) -- no third-party tile server touched at runtime
// at all, so there's no usage policy to violate and no per-tile billing
// to hit a ceiling on.
//
// Deliberately still its own file, dynamic-imported ssr:false from
// fleet-map.tsx exactly as before (MapLibre also touches `window` at
// import time, same reason Leaflet needed this) -- fleet-map.tsx's own
// Realtime subscription logic is completely untouched by this swap, only
// the rendering layer changed.
//
// NEXT_PUBLIC_FLEET_MAP_PMTILES_URL points at the actual .pmtiles file
// once it's uploaded (Cloudflare R2 or any HTTP(S) host supporting range
// requests) -- see .env.local.example for the placeholder and setup
// notes. Falls back to Protomaps' own public demo tile (a small sample
// area, NOT meant for production) so local dev never hard-fails before
// that env var is set.

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";
import { circlePolygon } from "@/lib/geo-circle";
import type { FleetVehicle } from "./fleet-map";

export type FleetGeofence = {
  id: string;
  center_latitude: number;
  center_longitude: number;
  radius_meters: number;
  is_active: boolean;
};

const PMTILES_URL =
  process.env.NEXT_PUBLIC_FLEET_MAP_PMTILES_URL ??
  "https://demo-bucket.protomaps.com/v4.pmtiles";

function isRecent(iso: string | null, minutes: number): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < minutes * 60_000;
}

// Registered once per page load, not per map instance -- addProtocol is a
// global maplibregl registration, calling it again per mount just
// re-points the same handler at itself.
let protocolRegistered = false;
function ensurePmtilesProtocol() {
  if (protocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  protocolRegistered = true;
}

function buildStyle(): maplibregl.StyleSpecification {
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

export default function FleetMapInner({
  vehicles,
  geofences = [],
}: {
  vehicles: FleetVehicle[];
  geofences?: FleetGeofence[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensurePmtilesProtocol();

    const center: [number, number] =
      vehicles.length > 0
        ? [
            vehicles.reduce((s, v) => s + v.lon, 0) / vehicles.length,
            vehicles.reduce((s, v) => s + v.lat, 0) / vehicles.length,
          ]
        : [-98.5795, 39.8283]; // geographic center of the US -- MapLibre wants [lon, lat], the opposite order Leaflet used

    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(),
      center,
      zoom: vehicles.length > 0 ? 9 : 3.5,
    });
    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current.on("load", () => {
      const map = mapRef.current;
      if (!map) return;
      map.addSource("fleet-geofences", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "fleet-geofences-fill",
        type: "fill",
        source: "fleet-geofences",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.06 },
      });
      map.addLayer({
        id: "fleet-geofences-line",
        type: "line",
        source: "fleet-geofences",
        paint: { "line-color": ["get", "color"], "line-width": 1.5, "line-dasharray": [2, 2] },
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // Deliberately empty-deps-equivalent (mount/unmount only) -- the map
    // instance itself is created once; live vehicle updates are handled
    // by the marker-sync effect below instead of recreating the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();
    for (const v of vehicles) {
      seen.add(v.id);
      const recent = isRecent(v.lastLocationAt, 15);
      let marker = markersRef.current.get(v.id);

      if (!marker) {
        const el = document.createElement("div");
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.borderRadius = "50%";
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.4)";

        const popupHtml = document.createElement("div");
        popupHtml.className = "text-sm";
        marker = new maplibregl.Marker({ element: el })
          .setLngLat([v.lon, v.lat])
          .setPopup(new maplibregl.Popup({ offset: 12 }).setDOMContent(popupHtml))
          .addTo(map);
        markersRef.current.set(v.id, marker);
      } else {
        marker.setLngLat([v.lon, v.lat]);
      }

      marker.getElement().style.background = recent ? "#2c6c99" : "#94a3b8";
      const popup = marker.getPopup();
      if (popup) {
        const content = document.createElement("div");
        content.className = "text-sm";
        content.innerHTML = `
          <p class="font-semibold">${escapeHtml(v.label)}</p>
          ${v.displayId ? `<p class="text-xs text-muted">${escapeHtml(v.displayId)}</p>` : ""}
          ${v.speed != null ? `<p class="text-xs">${Math.round(v.speed)} mph</p>` : ""}
          ${v.lastLocationAt ? `<p class="text-xs text-muted">${new Date(v.lastLocationAt).toLocaleTimeString()}</p>` : ""}
        `;
        popup.setDOMContent(content);
      }
    }

    // Drop markers for vehicles no longer in the list (removed/reassigned).
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
  }, [vehicles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyGeofences = () => {
      const source = map.getSource("fleet-geofences") as maplibregl.GeoJSONSource | undefined;
      if (!source) return;
      source.setData({
        type: "FeatureCollection",
        features: geofences.map((g) => {
          const f = circlePolygon(g.center_longitude, g.center_latitude, g.radius_meters);
          f.properties = { color: g.is_active ? "#2c6c99" : "#94a3b8" };
          return f;
        }),
      });
    };

    if (map.isStyleLoaded()) applyGeofences();
    else map.once("load", applyGeofences);
  }, [geofences]);

  return <div ref={containerRef} className="h-full w-full" />;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
