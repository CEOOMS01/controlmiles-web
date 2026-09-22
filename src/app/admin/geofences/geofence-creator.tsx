"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createGeofence, type CreateGeofenceState } from "./actions";
import type { MapVehicle, ExistingGeofence } from "./geofence-map-inner";

// Leaflet touches `window` at import time -- same ssr:false dynamic-import
// pattern as fleet-map.tsx/fleet-map-inner.tsx.
const GeofenceMap = dynamic(() => import("./geofence-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted">
      Loading map…
    </div>
  ),
});

const initialState: CreateGeofenceState = { error: null, success: false };

// Real request (explicit user ask, 2026-09-22): a zone needs to reach
// "one or two states" wide, not just a warehouse yard -- but a plain
// linear slider from 50m to 500km would waste almost its entire range on
// giant radii while giving a warehouse-sized zone (the common case) only
// a few pixels of travel. Mapped logarithmically instead (same fix
// volume/zoom sliders use for a wide dynamic range): slider position is
// t in [0, SLIDER_STEPS], radius = MIN_RADIUS_M * (MAX_RADIUS_M /
// MIN_RADIUS_M) ^ (t / SLIDER_STEPS), so small and large zones both get
// proportionally fine control. No database change needed -- the
// radius_meters column only ever enforced `> 0`.
const MIN_RADIUS_M = 50;
const MAX_RADIUS_M = 500_000; // 500km -- comfortably covers one or two US states from a central point
const SLIDER_STEPS = 1000;

function radiusToSlider(radiusMeters: number): number {
  const t = Math.log(radiusMeters / MIN_RADIUS_M) / Math.log(MAX_RADIUS_M / MIN_RADIUS_M);
  return Math.round(t * SLIDER_STEPS);
}

function sliderToRadius(sliderPos: number): number {
  const t = sliderPos / SLIDER_STEPS;
  return Math.round(MIN_RADIUS_M * Math.pow(MAX_RADIUS_M / MIN_RADIUS_M, t));
}

function formatRadius(radiusMeters: number): string {
  if (radiusMeters >= 1000) {
    return `${(radiusMeters / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
  }
  return `${radiusMeters.toLocaleString()} m`;
}

export function GeofenceCreator({
  orgId,
  mapVehicles,
  selectableVehicles,
  existing,
}: {
  orgId: string;
  // Only vehicles with a live GPS fix can be plotted as a marker; a vehicle
  // still needs to be pickable in the form even with no fix yet (e.g. just
  // added, or hasn't started a trip) -- these are deliberately two
  // different lists, not one filtered down for both uses.
  mapVehicles: MapVehicle[];
  selectableVehicles: { id: string; label: string }[];
  existing: ExistingGeofence[];
}) {
  const [state, formAction, pending] = useActionState(createGeofence, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [pendingCenter, setPendingCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(500);

  // React's own pattern for "reset local state when a prop/value from
  // elsewhere changes" -- compares against the previous render instead of
  // reacting after the fact in an effect, so this doesn't cause the
  // cascading-render setState-in-effect the linter (rightly) flags.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success) {
      setPendingCenter(null);
      setRadius(500);
    }
  }

  // Plain DOM reset (no React state involved) stays in an effect, same as
  // invite-form.tsx's own pattern elsewhere in this app.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="h-96 overflow-hidden rounded-xl border border-border">
        <GeofenceMap
          vehicles={mapVehicles}
          existing={existing}
          pendingCenter={pendingCenter}
          pendingRadius={radius}
          onPickCenter={(lat, lng) => setPendingCenter({ lat, lng })}
        />
      </div>

      <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
        <input type="hidden" name="org_id" value={orgId} />
        <input type="hidden" name="center_latitude" value={pendingCenter?.lat ?? ""} />
        <input type="hidden" name="center_longitude" value={pendingCenter?.lng ?? ""} />

        <p className="text-sm font-semibold">New zone</p>
        <p className="text-xs text-muted">
          Click a point on the map to set the center, then fill this in.
        </p>

        {pendingCenter ? (
          <p className="rounded-lg bg-accent/10 px-2.5 py-1.5 font-mono text-xs text-accent">
            {pendingCenter.lat.toFixed(5)}, {pendingCenter.lng.toFixed(5)}
          </p>
        ) : (
          <p className="rounded-lg bg-background px-2.5 py-1.5 text-xs text-muted">No point picked yet</p>
        )}

        <div>
          <label htmlFor="gf-vehicle" className="mb-1 block text-xs font-medium">Vehicle</label>
          <select
            id="gf-vehicle"
            name="vehicle_id"
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {selectableVehicles.length === 0 && <option value="">No vehicles yet</option>}
            {selectableVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="gf-name" className="mb-1 block text-xs font-medium">Zone name</label>
          <input
            id="gf-name"
            name="name"
            required
            placeholder="e.g. Warehouse yard"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="gf-radius" className="mb-1 block text-xs font-medium">
            Radius — {formatRadius(radius)}
          </label>
          <input
            id="gf-radius"
            type="range"
            min={0}
            max={SLIDER_STEPS}
            step={1}
            value={radiusToSlider(radius)}
            onChange={(e) => setRadius(sliderToRadius(Number(e.target.value)))}
            className="w-full"
          />
          <p className="mt-1 text-[11px] text-muted">
            50 m – 500 km — drag far right to cover a region the size of a state.
          </p>
          <input type="hidden" name="radius_meters" value={radius} />
        </div>

        <button
          type="submit"
          disabled={pending || !pendingCenter || selectableVehicles.length === 0}
          className="mt-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create zone"}
        </button>

        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}
