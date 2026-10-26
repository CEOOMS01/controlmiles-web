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
import { buildStyle, ensurePmtilesProtocol } from "@/lib/map-base";
import { circlePolygon } from "@/lib/geo-circle";
import { vehicleStatus, type FleetRoute, type FleetVehicle, type VehicleStatus } from "./fleet-map";

export type FleetGeofence = {
  id: string;
  center_latitude: number;
  center_longitude: number;
  radius_meters: number;
  is_active: boolean;
};

const STATUS_COLOR: Record<VehicleStatus, string> = {
  on_trip: "#2c6c99",
  no_signal: "#d97706",
  parked: "#94a3b8",
};

const STATUS_LABEL: Record<VehicleStatus, string> = {
  on_trip: "On trip",
  no_signal: "On trip · no signal for 15+ min",
  parked: "Parked · last known spot",
};

/** "just now", "12 min ago", "3 h ago", "Sep 28, 2:36 PM". */
function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function FleetMapInner({
  vehicles,
  geofences = [],
  routes = [],
  showParked = true,
}: {
  vehicles: FleetVehicle[];
  geofences?: FleetGeofence[];
  routes?: FleetRoute[];
  /** false on the school dashboard: a parked bus is clutter, only buses on a trip show. */
  showParked?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const framedRef = useRef("");
  const routePinsRef = useRef<maplibregl.Marker[]>([]);

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
      // Road paths of today's school routes (under the stop pins).
      map.addSource("school-route-paths", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "school-route-paths-line",
        type: "line",
        source: "school-route-paths",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 4, "line-opacity": 0.7 },
      });
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
      routePinsRef.current = [];
      framedRef.current = "";
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
      const status = vehicleStatus(v);
      if (status === "parked" && !showParked) continue;
      seen.add(v.id);
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

      marker.getElement().style.background = STATUS_COLOR[status];
      marker.getElement().style.opacity = status === "parked" ? "0.75" : "1";
      const popup = marker.getPopup();
      if (popup) {
        const content = document.createElement("div");
        content.className = "text-sm";
        content.innerHTML = `
          <p class="font-semibold">${escapeHtml(v.label)}</p>
          ${v.displayId ? `<p class="text-xs text-muted">${escapeHtml(v.displayId)}</p>` : ""}
          <p class="text-xs font-medium" style="color:${STATUS_COLOR[status]}">${STATUS_LABEL[status]}</p>
          ${status === "on_trip" && v.speed != null ? `<p class="text-xs">${Math.round(Math.max(0, v.speed) * 2.23694)} mph</p>` : ""}
          ${v.lastLocationAt ? `<p class="text-xs text-muted">${status === "parked" ? "Last seen" : "Updated"} ${escapeHtml(timeAgo(v.lastLocationAt))}</p>` : ""}
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
  }, [vehicles, showParked]);

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

  // School routes: one pin per stop, numbered in pick-up order (the farthest
  // from the school first); the school itself is the S pin. No lines: they
  // would only be straight segments, not the road.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of routePinsRef.current) m.remove();
    routePinsRef.current = [];
    const bounds = new maplibregl.LngLatBounds();
    for (const r of routes) {
      let n = 0; // numbers count the stops, not the school (the S pin)
      r.stops.forEach((st) => {
        const school = st.kind === "school";
        if (!school) n++;
        const el = document.createElement("div");
        el.style.cursor = "pointer";
        el.innerHTML = `<svg width="30" height="38" viewBox="0 0 30 38" aria-hidden="true"><path d="M15 37C15 37 2 23.5 2 14.5a13 13 0 0 1 26 0C28 23.5 15 37 15 37z" fill="${r.color}" stroke="#fff" stroke-width="2"/><text x="15" y="19.5" text-anchor="middle" font-size="${school ? 14 : 13}" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${school ? "S" : n}</text></svg>`;
        const content = document.createElement("div");
        content.className = "text-sm";
        content.innerHTML = `<p class="font-semibold">${escapeHtml(st.name)}</p><p class="text-xs text-muted">${escapeHtml(r.name)} · ${school ? "school" : `stop ${n}`}${st.time ? ` · ${escapeHtml(st.time)}` : ""}</p>${st.milesToSchool != null && !school ? `<p class="text-xs">${st.milesToSchool.toFixed(1)} mi from the school</p>` : ""}`;
        const pin = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([st.lon, st.lat])
          .setPopup(new maplibregl.Popup({ offset: 30 }).setDOMContent(content))
          .addTo(map);
        routePinsRef.current.push(pin);
        bounds.extend([st.lon, st.lat]);
      });
    }
    const applyPaths = () => {
      const source = map.getSource("school-route-paths") as maplibregl.GeoJSONSource | undefined;
      source?.setData({
        type: "FeatureCollection",
        features: routes
          .filter((r) => r.path && r.path.length > 1)
          .map((r) => ({
            type: "Feature" as const,
            properties: { color: r.color },
            geometry: { type: "LineString" as const, coordinates: r.path as [number, number][] },
          })),
      });
    };
    if (map.isStyleLoaded()) applyPaths();
    else map.once("load", applyPaths);
    // Frame the routes once per set of routes, so the person's own panning is left alone.
    const sig = routes.map((r) => `${r.id}:${r.stops.length}`).join("|");
    if (sig && sig !== framedRef.current && !bounds.isEmpty()) {
      framedRef.current = sig;
      // Once the map is loaded and its box has a size (a fit before that frames a zero-size map).
      const fit = () => {
        map.resize();
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
      };
      fit();
      map.once("load", fit);
      // The box can still be settling (fonts, layout) when the first fit runs:
      // refit on every size change for the first 3 s, then leave the camera to the person.
      const box = containerRef.current;
      if (box && typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(fit);
        ro.observe(box);
        const stop = setTimeout(() => ro.disconnect(), 3000);
        return () => {
          clearTimeout(stop);
          ro.disconnect();
        };
      }
    }
  }, [routes]);

  return <div ref={containerRef} className="h-full w-full" />;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
