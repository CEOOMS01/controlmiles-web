"use client";

// Per-trip route map for the Report Portal: the driven path from the trip's
// start (blue arrow) to its end (gold tile). Drawn with MapLibre on our own
// basemap (src/lib/map-base.ts) like every other web map; it used to be Leaflet
// on tile.openstreetmap.org, which OSM's tile policy does not allow at scale.
//
// The path is the recorded GPS points joined in order (or a 2-point A-to-B line
// when the trip has no breadcrumbs). It is not snapped to the road.

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildStyle, ensurePmtilesProtocol } from "@/lib/map-base";
import { END_MARKER, START_MARKER } from "@/lib/trip-map/markers";
import type { PortalRoutePoint } from "./report-data";

// `marker` is one of our own constant drawings, never data from a trip.
function endpointEl(marker: string) {
  const el = document.createElement("div");
  el.style.width = "26px";
  el.style.height = "26px";
  el.style.filter = "drop-shadow(0 1px 3px rgba(0,0,0,0.4))";
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26">${marker}</svg>`;
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

    const start = new maplibregl.Marker({ element: endpointEl(START_MARKER) }).setLngLat(coords[0]).addTo(map);
    const end = new maplibregl.Marker({ element: endpointEl(END_MARKER) }).setLngLat(coords[coords.length - 1]).addTo(map);

    return () => {
      start.remove();
      end.remove();
      map.remove();
    };
  }, [points]);

  if (points.length < 2) return null;
  return <div ref={containerRef} className="h-full w-full" />;
}
