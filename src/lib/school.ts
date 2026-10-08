// School transportation (2026-10-09): shared labels and small helpers for the
// School pages.

export const ROUTE_TYPE_LABEL: Record<string, string> = {
  school_am: "AM (to school)",
  school_pm: "PM (home)",
};

export const STOP_KIND_LABEL: Record<string, string> = {
  pickup: "Pick-up",
  school: "School",
  dropoff: "Drop-off",
};

/** ISO weekday numbers, 1 = Monday. */
export const WEEKDAYS: { n: number; short: string }[] = [
  { n: 1, short: "Mon" },
  { n: 2, short: "Tue" },
  { n: 3, short: "Wed" },
  { n: 4, short: "Thu" },
  { n: 5, short: "Fri" },
  { n: 6, short: "Sat" },
  { n: 7, short: "Sun" },
];

export function daysLabel(days: number[] | null | undefined): string {
  const set = new Set(days ?? []);
  if ([1, 2, 3, 4, 5].every((d) => set.has(d)) && !set.has(6) && !set.has(7)) return "Mon–Fri";
  return WEEKDAYS.filter((d) => set.has(d.n))
    .map((d) => d.short)
    .join(", ");
}

/** "07:05:00" -> "7:05 AM" (or "07:05" in 24 h). Plain `time` values, no timezone math. */
export function clock(t: string | null | undefined, format: "12h" | "24h" = "12h"): string {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = Number(h);
  if (format === "24h") return `${String(hour).padStart(2, "0")}:${m}`;
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

/** Minutes since midnight of a "HH:MM[:SS]" value. */
export function minutesOf(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

/** Today's date and wall-clock minutes in the fleet's timezone. */
export function fleetNow(timezone: string): { date: string; minutes: number; isoDow: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    isoDow: dow,
  };
}
