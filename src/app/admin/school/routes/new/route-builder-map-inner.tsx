"use client";

// Olympus Mont Systems LLC - ControlMiles
// src/app/admin/school/routes/new/route-builder-map-inner.tsx
//
// The route builder's map (MapLibre + the same self-hosted PMTiles basemap as
// the fleet map): click to add a stop, numbered pins you can drag, and the
// route drawn through the stops in order. The line joins the stops in a
// straight line between each pair; it is a planning aid, not turn-by-turn.

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";

export type MapStop = { key: string; lat: number; lng: number; kind: string };

const PMTILES_URL = process.env.NEXT_PUBLIC_FLEET_MAP_PMTILES_URL ?? "https://demo-bucket.protomaps.com/v4.pmtiles";

let protocolRegistered = false;
function ensurePmtilesProtocol() {
  if (protocolRegistered) return;
  maplibregl.addProtocol("pmtiles", new Protocol().tile);
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

function pinEl(n: number, kind: string) {
  const el = document.createElement("div");
  const color = kind === "school" ? "#bd5b26" : "#2c6c99";
  el.textContent = kind === "school" ? "S" : String(n);
  el.style.cssText = `width:28px;height:28px;border-radius:50%;background:${color};color:#fff;font:600 13px system-ui;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);cursor:grab`;
  return el;
}

export default function RouteBuilderMapInner({
  stops,
  center,
  zoom,
  fitToken,
  onAdd,
  onMove,
}: {
  stops: MapStop[];
  center: [number, number];
  zoom: number;
  /** Changes when the map should re-fit to the stops (a stop was added or searched). */
  fitToken: number;
  onAdd: (lat: number, lng: number) => void;
  onMove: (key: string, lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onAddRef = useRef(onAdd);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onAddRef.current = onAdd;
    onMoveRef.current = onMove;
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensurePmtilesProtocol();
    const map = new maplibregl.Map({ container: containerRef.current, style: buildStyle(), center, zoom });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.getCanvas().style.cursor = "crosshair";
    map.on("click", (e) => onAddRef.current(e.lngLat.lat, e.lngLat.lng));
    map.on("load", () => {
      map.addSource("route-line", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route-line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#2c6c99", "line-width": 4, "line-opacity": 0.85 },
      });
      drawLine();
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopsRef = useRef(stops);
  useEffect(() => {
    stopsRef.current = stops;
  });

  function drawLine() {
    const map = mapRef.current;
    const src = map?.getSource("route-line") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const coords = stopsRef.current.map((s) => [s.lng, s.lat]);
    src.setData({
      type: "FeatureCollection",
      features: coords.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] : [],
    });
  }

  // Pins and line follow the stop list.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = stops.map((s, i) => {
      const marker = new maplibregl.Marker({ element: pinEl(i + 1, s.kind), draggable: true })
        .setLngLat([s.lng, s.lat])
        .addTo(map);
      marker.getElement().addEventListener("click", (ev) => ev.stopPropagation());
      marker.on("dragend", () => {
        const p = marker.getLngLat();
        onMoveRef.current(s.key, p.lat, p.lng);
      });
      return marker;
    });
    drawLine();
  }, [stops]);

  // Re-fit when a stop is added or searched (not on every drag).
  useEffect(() => {
    const map = mapRef.current;
    const list = stopsRef.current;
    if (!map || list.length === 0) return;
    if (list.length === 1) {
      map.easeTo({ center: [list[0].lng, list[0].lat], zoom: Math.max(map.getZoom(), 14) });
      return;
    }
    const b = new maplibregl.LngLatBounds();
    for (const s of list) b.extend([s.lng, s.lat]);
    map.fitBounds(b, { padding: 70, maxZoom: 16, duration: 500 });
  }, [fitToken]);

  return <div ref={containerRef} className="h-full min-h-[420px] w-full rounded-xl" />;
}
