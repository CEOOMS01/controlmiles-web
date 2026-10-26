"use client";

// Per-trip route map for the Report Portal: the driven path from point A
// (green, trip start) to point B (red, trip end). Drawn with MapLibre on our own
// basemap (src/lib/map-base.ts) like every other web map; it used to be Leaflet
// on tile.openstreetmap.org, which OSM's tile policy does not allow at scale.
//
// The path is the recorded GPS points joined in order (or a 2-point A-to-B line
// when the trip has no breadcrumbs). It is not snapped to the road.

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildStyle, ensurePmtilesProtocol } from "@/lib/map-base";
import type { PortalRoutePoint } from "./report-data";

// Green for point A, red for point B: distinct colors so the direction of
// travel is obvious even on a route that loops back near itself.
function endpointEl(color: string) {
  const el = document.createElement("div");
  el.style.width = "14px";
  el.style.height = "14px";
  el.style.borderRadius = "50%";
  el.style.background = color;
  el.style.border = "2px solid white";
  el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.4)";
  return el;
}

export default function RouteMapInner({ points }: { points: PortalRoutePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || points.length < 2) return;
    ensurePmtilesProtocol();

    const coords = points.map((p) => [p.lng, p.lat] as [number, number]);
    const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(),
      bounds,
      fitBoundsOptions: { padding: 24, maxZoom: 16 },
      // A report map is a picture to read, not a map to browse: no scroll-zoom
      // hijack while the person scrolls the report page.
      scrollZoom: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("trip-route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
      });
      map.addLayer({
        id: "trip-route-line",
        type: "line",
        source: "trip-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#2c6c99", "line-width": 4 },
      });
    });

    const start = new maplibregl.Marker({ element: endpointEl("#16a34a") }).setLngLat(coords[0]).addTo(map);
    const end = new maplibregl.Marker({ element: endpointEl("#dc2626") }).setLngLat(coords[coords.length - 1]).addTo(map);

    return () => {
      start.remove();
      end.remove();
      map.remove();
    };
  }, [points]);

  if (points.length < 2) return null;
  return <div ref={containerRef} className="h-full w-full" />;
}
