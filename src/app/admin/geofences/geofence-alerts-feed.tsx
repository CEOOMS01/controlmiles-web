"use client";

// Olympus Mont Systems LLC - ControlMiles
// src/app/admin/geofences/geofence-alerts-feed.tsx
//
// Real fix (explicit user request, 2026-09-22): geofence crossings were
// only ever a pull-on-page-load table -- an admin had to manually refresh
// to see a new one, even though the crossing is detected and inserted
// server-side (inside update_vehicle_location) the instant it happens.
// Subscribes to Realtime INSERT events on vehicle_geofence_alerts and
// prepends them live, same getRealtimeAccessToken() token-scoping pattern
// fleet-map.tsx already established (httpOnly auth cookies mean the
// browser Supabase client can never authenticate a Realtime channel on
// its own -- see that action's own header comment for the full why).

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRealtimeAccessTokenAnyTier } from "../realtime-actions";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

const REALTIME_TOKEN_REFRESH_MS = 20 * 60_000;

export type AlertRow = {
  id: string;
  vehicle_id: string;
  geofence_id: string;
  distance_meters: number;
  created_at: string;
};

export function GeofenceAlertsFeed({
  orgId,
  initialAlerts,
  geofenceNameById,
  vehicleLabelById,
}: {
  orgId: string;
  initialAlerts: AlertRow[];
  geofenceNameById: Record<string, string>;
  vehicleLabelById: Record<string, string>;
}) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [justArrived, setJustArrived] = useState<Set<string>>(new Set());
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    const supabase = supabaseRef.current;
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    async function authenticateAndSubscribe() {
      const token = await getRealtimeAccessTokenAnyTier();
      if (cancelled) return;
      if (token) supabase.realtime.setAuth(token);

      channel = supabase
        .channel(`geofence-alerts-${orgId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "vehicle_geofence_alerts",
            filter: `organization_id=eq.${orgId}`,
          },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const row = payload.new as Record<string, unknown>;
            const alert: AlertRow = {
              id: row.id as string,
              vehicle_id: row.vehicle_id as string,
              geofence_id: row.geofence_id as string,
              distance_meters: row.distance_meters as number,
              created_at: row.created_at as string,
            };
            setAlerts((prev) => (prev.some((a) => a.id === alert.id) ? prev : [alert, ...prev].slice(0, 25)));
            setJustArrived((prev) => new Set(prev).add(alert.id));
            setTimeout(() => {
              setJustArrived((prev) => {
                const next = new Set(prev);
                next.delete(alert.id);
                return next;
              });
            }, 5000);
          },
        )
        .subscribe();

      refreshTimer = setInterval(async () => {
        const freshToken = await getRealtimeAccessTokenAnyTier();
        if (!cancelled && freshToken) supabase.realtime.setAuth(freshToken);
      }, REALTIME_TOKEN_REFRESH_MS);
    }

    authenticateAndSubscribe();

    return () => {
      cancelled = true;
      if (refreshTimer) clearInterval(refreshTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [orgId]);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-4 py-3 font-medium">Zone</th>
            <th className="px-4 py-3 font-medium">Vehicle</th>
            <th className="px-4 py-3 font-medium">Distance</th>
            <th className="px-4 py-3 font-medium">When</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr
              key={a.id}
              className={`border-b border-border last:border-0 transition-colors ${justArrived.has(a.id) ? "bg-accent/10" : ""}`}
            >
              <td className="px-4 py-3">{geofenceNameById[a.geofence_id] ?? "—"}</td>
              <td className="px-4 py-3 text-muted">{vehicleLabelById[a.vehicle_id] ?? "—"}</td>
              <td className="px-4 py-3 font-mono tabular-nums">
                {Math.round(a.distance_meters).toLocaleString()} m out
              </td>
              <td className="px-4 py-3 text-muted">{new Date(a.created_at).toLocaleString()}</td>
            </tr>
          ))}
          {alerts.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-muted">
                No crossings recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
