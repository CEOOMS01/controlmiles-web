"use client";

// Olympus Mont Systems LLC - ControlMiles
// src/app/admin/geofences/geofence-map-inner.tsx
//
// Migrated off Leaflet + raw OpenStreetMap tiles onto MapLibre GL JS +
// self-hosted PMTiles (2026-09-22), same reasoning and same basemap as
// fleet-map-inner.tsx -- was a separate map instance on OSM's rate-limited
// free tile server, now consistent with the rest of the admin dashboard.
//
// A MapLibre `circle` layer's circle-radius is in SCREEN PIXELS, not
// meters -- it would visually shrink/grow as the admin zooms in and out
// instead of representing a fixed real-world geofence radius. Rendered as
// a real geodesic polygon (circlePolygon below) instead, same technique
// GIS tools use, so a 500m zone always covers the same ground regardless
// of zoom.

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";
import { circlePolygon } from "@/lib/geo-circle";

export type MapVehicle = { id: string; label: string; lat: number; lon: number };
export type ExistingGeofence = {
  id: string;
  name: string;
  center_latitude: number;
  center_longitude: number;
  radius_meters: number;
  is_active: boolean;
};

const PMTILES_URL =
  process.env.NEXT_PUBLIC_FLEET_MAP_PMTILES_URL ??
  "https://demo-bucket.protomaps.com/v4.pmtiles";

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

function vehicleMarkerEl() {
  const el = document.createElement("div");
  el.style.width = "14px";
  el.style.height = "14px";
  el.style.borderRadius = "50%";
  el.style.background = "#2c6c99";
  el.style.border = "2px solid white";
  el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.4)";
  return el;
}

function centerMarkerEl() {
  const el = document.createElement("div");
  el.style.width = "12px";
  el.style.height = "12px";
  el.style.borderRadius = "50% 50% 50% 0";
  el.style.background = "#bd5b26";
  el.style.border = "2px solid white";
  el.style.transform = "rotate(-45deg)";
  el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.4)";
  return el;
}

export default function GeofenceMapInner({
  vehicles,
  existing,
  pendingCenter,
  pendingRadius,
  onPickCenter,
}: {
  vehicles: MapVehicle[];
  existing: ExistingGeofence[];
  pendingCenter: { lat: number; lng: number } | null;
  pendingRadius: number;
  onPickCenter: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const vehicleMarkersRef = useRef<maplibregl.Marker[]>([]);
  const centerMarkerRef = useRef<maplibregl.Marker | null>(null);
  // onPickCenter is a fresh closure every render (inline arrow in the
  // parent) -- read through a ref inside the one-time click handler
  // instead of re-registering the map click listener on every render.
  const onPickCenterRef = useRef(onPickCenter);
  onPickCenterRef.current = onPickCenter;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensurePmtilesProtocol();

    const center: [number, number] =
      vehicles.length > 0
        ? [vehicles[0].lon, vehicles[0].lat]
        : existing.length > 0
          ? [existing[0].center_longitude, existing[0].center_latitude]
          : [-98.5795, 39.8283];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(),
      center,
      zoom: vehicles.length > 0 || existing.length > 0 ? 10 : 3.5,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("click", (e) => onPickCenterRef.current(e.lngLat.lat, e.lngLat.lng));

    map.on("load", () => {
      map.addSource("existing-geofences", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "existing-geofences-fill",
        type: "fill",
        source: "existing-geofences",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "existing-geofences-line",
        type: "line",
        source: "existing-geofences",
        paint: { "line-color": ["get", "color"], "line-width": 2 },
      });

      map.addSource("pending-geofence", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "pending-geofence-fill",
        type: "fill",
        source: "pending-geofence",
        paint: { "fill-color": "#bd5b26", "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: "pending-geofence-line",
        type: "line",
        source: "pending-geofence",
        paint: { "line-color": "#bd5b26", "line-width": 2 },
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Mount/unmount only, same as fleet-map-inner.tsx -- live prop changes
    // are synced by the effects below instead of recreating the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of vehicleMarkersRef.current) m.remove();
    vehicleMarkersRef.current = vehicles.map((v) =>
      new maplibregl.Marker({ element: vehicleMarkerEl() }).setLngLat([v.lon, v.lat]).addTo(map),
    );
  }, [vehicles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource("existing-geofences") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: "FeatureCollection",
      features: existing.map((g) => {
        const f = circlePolygon(g.center_longitude, g.center_latitude, g.radius_meters);
        f.properties = { color: g.is_active ? "#2c6c99" : "#94a3b8" };
        return f;
      }),
    });
  }, [existing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    centerMarkerRef.current?.remove();
    centerMarkerRef.current = null;

    const applyPending = () => {
      const source = map.getSource("pending-geofence") as maplibregl.GeoJSONSource | undefined;
      if (!source) return;
      if (!pendingCenter) {
        source.setData({ type: "FeatureCollection", features: [] });
        return;
      }
      source.setData({
        type: "FeatureCollection",
        features: [circlePolygon(pendingCenter.lng, pendingCenter.lat, pendingRadius)],
      });
      centerMarkerRef.current = new maplibregl.Marker({ element: centerMarkerEl() })
        .setLngLat([pendingCenter.lng, pendingCenter.lat])
        .addTo(map);
    };

    if (map.isStyleLoaded()) applyPending();
    else map.once("load", applyPending);
  }, [pendingCenter, pendingRadius]);

  return <div ref={containerRef} className="h-full w-full" />;
}
