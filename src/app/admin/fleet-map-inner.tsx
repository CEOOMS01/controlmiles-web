"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FleetVehicle } from "./fleet-map";

// Leaflet's default marker icon references image paths that break under
// bundlers (a well-known Leaflet+webpack issue -- getIconUrl resolves
// relative to the wrong origin). Sidestepped entirely with a small inline
// SVG divIcon instead of fighting asset imports for three PNG files.
function vehicleIcon(recent: boolean) {
  const color = recent ? "#2c6c99" : "#94a3b8";
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function isRecent(iso: string | null, minutes: number): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < minutes * 60_000;
}

export default function FleetMapInner({ vehicles }: { vehicles: FleetVehicle[] }) {
  const center: [number, number] =
    vehicles.length > 0
      ? [
          vehicles.reduce((s, v) => s + v.lat, 0) / vehicles.length,
          vehicles.reduce((s, v) => s + v.lon, 0) / vehicles.length,
        ]
      : [39.8283, -98.5795]; // geographic center of the US -- only used when there's nothing to fit to yet

  return (
    <MapContainer center={center} zoom={vehicles.length > 0 ? 9 : 4} className="h-full w-full">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {vehicles.map((v) => (
        <Marker key={v.id} position={[v.lat, v.lon]} icon={vehicleIcon(isRecent(v.lastLocationAt, 15))}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{v.label}</p>
              {v.displayId && <p className="text-xs text-muted">{v.displayId}</p>}
              {v.speed != null && <p className="text-xs">{Math.round(v.speed)} mph</p>}
              {v.lastLocationAt && (
                <p className="text-xs text-muted">
                  {new Date(v.lastLocationAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
