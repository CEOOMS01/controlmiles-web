// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/idle.ts
//
// Idle time rollups (2026-09-30). The events come from the
// compute_idle_events RPC: "stopped 3+ min while a trip is running", read
// from the GPS trail (no engine data -- see that migration's header).
// Stops of 60+ min are "long stops" (likely parked) and are never costed.
//
// Idle fuel burn, per the US DOE's Alternative Fuels Data Center idling
// figures: light-duty gasoline vehicles burn roughly 0.2-0.5 gal/h at
// idle, heavy-duty diesel trucks roughly 0.8 gal/h. The midpoint-ish
// values below give an ESTIMATE, labelled as such in the UI.

export type IdleEvent = {
  session_id: string;
  vehicle_id: string | null;
  user_id: string;
  started_at: string;
  minutes: number;
  latitude: number;
  longitude: number;
  kind: "idle" | "long_stop";
};

export const IDLE_GAL_PER_HOUR: Record<"diesel" | "gasoline", number> = {
  gasoline: 0.4,
  diesel: 0.8,
};

/** Price used when the fleet has no receipts with a price yet. */
export const FALLBACK_PRICE_PER_GALLON = 3.5;

export type IdleTotals = {
  idleMinutes: number;
  idleEvents: number;
  longStopMinutes: number;
  longStops: number;
  estGallons: number;
  estCost: number;
};

export function emptyTotals(): IdleTotals {
  return { idleMinutes: 0, idleEvents: 0, longStopMinutes: 0, longStops: 0, estGallons: 0, estCost: 0 };
}

/** Adds one event to a running total, costing only true idle. */
export function addIdle(
  t: IdleTotals,
  e: IdleEvent,
  fuel: "diesel" | "gasoline",
  pricePerGallon: number,
): void {
  if (e.kind === "long_stop") {
    t.longStops += 1;
    t.longStopMinutes += e.minutes;
    return;
  }
  const gallons = (e.minutes / 60) * IDLE_GAL_PER_HOUR[fuel];
  t.idleEvents += 1;
  t.idleMinutes += e.minutes;
  t.estGallons += gallons;
  t.estCost += gallons * pricePerGallon;
}

/** "1 h 25 min" / "12 min". */
export function formatMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
