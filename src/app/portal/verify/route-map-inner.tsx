"use client";

import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PortalRoutePoint } from "./report-data";

// Leaflet's default marker icon references image paths that break under
// bundlers -- same well-known issue admin/fleet-map-inner.tsx already
// sidesteps with an inline SVG divIcon instead of fighting asset
// imports for three PNG files. Green for point A (trip start), red for
// point B (trip end) -- distinct colors so the direction of travel is
// obvious even on a route that loops back near itself.
function endpointIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function RouteMapInner({ points }: { points: PortalRoutePoint[] }) {
  if (points.length < 2) return null;

  const positions: [number, number][] = points.map((p) => [p.lat, p.lng]);
  const start = positions[0];
  const end = positions[positions.length - 1];

  const lats = positions.map((p) => p[0]);
  const lngs = positions.map((p) => p[1]);
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];

  return (
    <MapContainer bounds={bounds} boundsOptions={{ padding: [24, 24] }} className="h-full w-full">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Polyline positions={positions} pathOptions={{ color: "#2c6c99", weight: 4 }} />
      <Marker position={start} icon={endpointIcon("#16a34a")} />
      <Marker position={end} icon={endpointIcon("#dc2626")} />
    </MapContainer>
  );
}
