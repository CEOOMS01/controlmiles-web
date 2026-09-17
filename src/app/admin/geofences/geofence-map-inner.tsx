"use client";

import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapVehicle = { id: string; label: string; lat: number; lon: number };
export type ExistingGeofence = {
  id: string;
  name: string;
  center_latitude: number;
  center_longitude: number;
  radius_meters: number;
  is_active: boolean;
};

function vehicleIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:#2c6c99;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// Same divIcon-instead-of-default-marker workaround as fleet-map-inner.tsx
// (Leaflet's bundled marker icon paths break under bundlers) -- this one's
// styled as a small pin so it reads distinctly from a live vehicle dot.
function centerIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:12px;height:12px;border-radius:50% 50% 50% 0;background:#bd5b26;border:2px solid white;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 12],
  });
}

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
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
  const center: [number, number] =
    vehicles.length > 0
      ? [vehicles[0].lat, vehicles[0].lon]
      : existing.length > 0
        ? [existing[0].center_latitude, existing[0].center_longitude]
        : [39.8283, -98.5795];

  return (
    <MapContainer center={center} zoom={vehicles.length > 0 || existing.length > 0 ? 10 : 4} className="h-full w-full">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <ClickCapture onPick={onPickCenter} />

      {vehicles.map((v) => (
        <Marker key={v.id} position={[v.lat, v.lon]} icon={vehicleIcon()} />
      ))}

      {existing.map((g) => (
        <Circle
          key={g.id}
          center={[g.center_latitude, g.center_longitude]}
          radius={g.radius_meters}
          pathOptions={{
            color: g.is_active ? "#2c6c99" : "#94a3b8",
            fillColor: g.is_active ? "#2c6c99" : "#94a3b8",
            fillOpacity: 0.08,
            dashArray: g.is_active ? undefined : "4 4",
          }}
        />
      ))}

      {pendingCenter && (
        <>
          <Marker position={[pendingCenter.lat, pendingCenter.lng]} icon={centerIcon()} />
          <Circle
            center={[pendingCenter.lat, pendingCenter.lng]}
            radius={pendingRadius}
            pathOptions={{ color: "#bd5b26", fillColor: "#bd5b26", fillOpacity: 0.12 }}
          />
        </>
      )}
    </MapContainer>
  );
}
