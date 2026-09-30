// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/safety-score.ts
//
// Driver safety score presentation (2026-09-30). The score itself is
// computed in the database (driver_safety_scores / fn_safety_score, see
// migration 20260930170000): 100 - weighted events per 100 miles, with
// harsh braking 3, hard acceleration 2, speeding 5 points; null under
// 20 miles. fleetScore() mirrors that formula for the fleet total.

export type ScoreRow = {
  user_id: string;
  bucket_start: string;
  miles: number;
  trips: number;
  harsh_braking: number;
  hard_acceleration: number;
  speeding: number;
  points: number;
  score: number | null;
};

export const MIN_MILES_TO_RATE = 20;
export const EVENT_POINTS = { harsh_braking: 3, hard_acceleration: 2, speeding: 5 } as const;

/** Same formula as fn_safety_score, over summed points and miles. */
export function fleetScore(points: number, miles: number): number | null {
  if (miles < MIN_MILES_TO_RATE) return null;
  return Math.max(0, Math.round(100 - (points * 100) / miles));
}

export type Grade = { label: string; badge: string; stroke: string };

/** Bands used by the scorecard (coaching-oriented, like Samsara/Motive). */
export function grade(score: number | null): Grade {
  if (score == null) return { label: "Not enough driving", badge: "bg-foreground/10 text-muted", stroke: "#94a3b8" };
  if (score >= 90) return { label: "Excellent", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", stroke: "#10b981" };
  if (score >= 75) return { label: "Good", badge: "bg-sky-500/15 text-sky-700 dark:text-sky-400", stroke: "#0ea5e9" };
  if (score >= 60) return { label: "Needs coaching", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400", stroke: "#f59e0b" };
  return { label: "At risk", badge: "bg-danger/15 text-danger", stroke: "#dc2626" };
}

/** The Monday-starting weeks (YYYY-MM-DD) covering the last `count` weeks. */
export function lastWeeks(today: Date, count: number): string[] {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const w = new Date(d);
    w.setUTCDate(d.getUTCDate() - i * 7);
    out.push(w.toISOString().slice(0, 10));
  }
  return out;
}
