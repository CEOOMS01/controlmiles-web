// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/school-pricing.ts
//
// Driving school pricing (user decision 2026-10-20; driving schools only --
// other services keep the fleet prices until their own pricing is set).
// Same numbers as supabase/functions/_shared/school_pricing.ts (billing) and
// fn_org_branch_allowance_internal (the database limit).

export type Tier = "starter" | "growth" | "enterprise";

export const SCHOOL_TIER_PRICE: Record<Tier, string> = { starter: "$14.99", growth: "$24.99", enterprise: "$34.99" };

export const SCHOOL_BRANCHES: Record<Tier, { included: number; max: number; extra: string } | null> = {
  starter: { included: 1, max: 2, extra: "$24.99" },
  growth: { included: 2, max: 4, extra: "$19.99" },
  enterprise: null,
};

/** "1 branch included · up to 2" style line for a plan. */
export function schoolBranchLine(tier: Tier): string {
  const b = SCHOOL_BRANCHES[tier];
  if (!b) return "Unlimited branches";
  const more = b.max - b.included;
  return `${b.included} ${b.included === 1 ? "branch" : "branches"} included · up to ${more} more at ${b.extra}/mo${more > 1 ? " each" : ""}`;
}
