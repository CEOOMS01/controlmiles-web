// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/school-pricing.ts
//
// Driving school pricing (user decisions 2026-10-20; driving schools only --
// other services keep the fleet prices until their own pricing is set).
// A monthly base that includes 3 cars and the software, then a price per
// extra car that drops from the 16th car (Stripe graduated tiers). Starter
// allows up to 10 cars. Branches beyond the plan's included ones are extra.
// Same numbers as supabase/functions/_shared/school_pricing.ts (billing),
// fn_org_branch_allowance_internal and fn_vehicles_school_limit (database).

export type Tier = "starter" | "growth" | "enterprise";

export type SchoolRate = {
  /** Monthly base, in cents, covering the first `included` cars. */
  base: number;
  included: number;
  /** Per extra car, in cents, from car included+1. */
  extra: number;
  /** Per car from car `volumeFrom` on (null = same as extra). */
  volume: number | null;
  volumeFrom: number;
  /** Most cars the plan allows (null = no limit). */
  maxCars: number | null;
};

export const SCHOOL_RATES: Record<Tier, SchoolRate> = {
  starter: { base: 5900, included: 3, extra: 1299, volume: null, volumeFrom: 16, maxCars: 10 },
  growth: { base: 12500, included: 3, extra: 1999, volume: 1699, volumeFrom: 16, maxCars: null },
  enterprise: { base: 17500, included: 3, extra: 2799, volume: 2399, volumeFrom: 16, maxCars: null },
};

export const SCHOOL_BRANCHES: Record<Tier, { included: number; max: number; extra: string; extraCents: number } | null> = {
  starter: { included: 1, max: 2, extra: "$24.99", extraCents: 2499 },
  growth: { included: 2, max: 4, extra: "$19.99", extraCents: 1999 },
  enterprise: null,
};

/** 12500 -> "$125"; 1999 -> "$19.99". */
export function usd(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

/** Monthly price of the plan for a number of cars (branches not included). */
export function schoolMonthlyCents(tier: Tier, cars: number): number {
  const r = SCHOOL_RATES[tier];
  const n = Math.max(cars, 0);
  const mid = Math.max(Math.min(n, r.volumeFrom - 1) - r.included, 0);
  const high = Math.max(n - (r.volumeFrom - 1), 0);
  return r.base + mid * r.extra + high * (r.volume ?? r.extra);
}

/** Extra branches billed on a plan for a number of active branches. */
export function schoolBranchExtras(tier: Tier, branches: number): number {
  const b = SCHOOL_BRANCHES[tier];
  return b ? Math.min(Math.max(branches - b.included, 0), b.max - b.included) : 0;
}

/** "1 branch included · up to 1 more at $24.99/mo" style line for a plan. */
export function schoolBranchLine(tier: Tier): string {
  const b = SCHOOL_BRANCHES[tier];
  if (!b) return "Unlimited branches";
  const more = b.max - b.included;
  return `${b.included} ${b.included === 1 ? "branch" : "branches"} included · up to ${more} more at ${b.extra}/mo${more > 1 ? " each" : ""}`;
}

/** "3 cars included · $19.99 per extra car ($16.99 from the 16th)". */
export function schoolCarsLine(tier: Tier): string {
  const r = SCHOOL_RATES[tier];
  const volume = r.volume != null ? ` (${usd(r.volume)} from the ${r.volumeFrom}th)` : "";
  const max = r.maxCars != null ? ` · up to ${r.maxCars} cars` : "";
  return `${r.included} cars included · ${usd(r.extra)} per extra car${volume}${max}`;
}
