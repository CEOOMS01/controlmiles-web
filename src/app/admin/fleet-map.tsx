"use client";

// Fleet live map (2026-09-09, explicit user request): "fleet app is the
// basics, heavy fleet-admin stuff lives on web" -- this used to be
// mobile-only by design (see the old note this replaces on
// admin/page.tsx); the standing rule now pulls it onto web instead.
// Mirrors the mobile app's own fleet_live_map_screen.dart exactly:
// Leaflet + raw OpenStreetMap tiles (no API key/billing, same reasoning
// as flutter_map there) and a Supabase Realtime channel on `vehicles`
// UPDATE events (already enabled in the publication -- built for the
// mobile map, reused here, no migration needed) instead of polling.

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export type FleetVehicle = {
  id: string;
  displayId: string | null;
  label: string;
  lat: number;
  lon: number;
  speed: number | null;
  lastLocationAt: string | null;
};

// Leaflet touches `window` at import time, so the whole map has to be
// client-only -- dynamic-imported with ssr:false rather than just
// "use client" alone, which still gets pre-rendered on the server once.
const MapInner = dynamic(() => import("./fleet-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted">
      Loading map…
    </div>
  ),
});

function isRecent(iso: string | null, minutes: number): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < minutes * 60_000;
}

export function FleetMap({
  orgId,
  initialVehicles,
}: {
  orgId: string;
  initialVehicles: FleetVehicle[];
}) {
  const [vehicles, setVehicles] = useState(initialVehicles);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`fleet-live-map-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "vehicles",
          filter: `organization_id=eq.${orgId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = payload.new as Record<string, unknown>;
          const lat = row.last_latitude as number | null;
          const lon = row.last_longitude as number | null;
          if (lat == null || lon == null) return;

          setVehicles((prev) => {
            const id = row.id as string;
            const next: FleetVehicle = {
              id,
              displayId: (row.display_id as string | null) ?? null,
              label:
                (row.nickname as string | null) ||
                (row.display_id as string | null) ||
                "Vehicle",
              lat,
              lon,
              speed: (row.last_speed as number | null) ?? null,
              lastLocationAt: (row.last_location_at as string | null) ?? null,
            };
            const exists = prev.some((v) => v.id === id);
            return exists ? prev.map((v) => (v.id === id ? next : v)) : [...prev, next];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  const activeCount = vehicles.filter((v) => isRecent(v.lastLocationAt, 15)).length;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-semibold">Live fleet map</p>
          <p className="text-sm text-muted">
            {vehicles.length === 0
              ? "No vehicles reporting location yet."
              : `${activeCount} of ${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"} active in the last 15 min.`}
          </p>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
          Vehicles show up here once a driver starts a trip.
        </div>
      ) : (
        <div className="h-96 overflow-hidden rounded-lg">
          <MapInner vehicles={vehicles} />
        </div>
      )}
    </div>
  );
}
