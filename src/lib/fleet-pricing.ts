// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/fleet-pricing.ts
//
// The ONE fleet price list for every service (2026-10-23): a monthly plan with
// its cars included, extra cars, branches, plus the one-time acquisition of the
// service. The numbers live in the database (public_pricing_catalog(), same
// source billing uses); the constants below are only the fallback when the
// database cannot be reached, so the page never shows an empty price table.

import type { getTranslations } from "next-intl/server";
import type { Plan } from "@/lib/fleet-plans";
import type { Tier } from "@/lib/school-pricing";
import { usd } from "@/lib/school-pricing";

type T = Awaited<ReturnType<typeof getTranslations>>;

export type CatalogPlan = {
  tier: Tier;
  base_cents: number;
  included_cars: number;
  max_cars: number | null;
  extra_car_cents: number;
  volume_from: number | null;
  volume_car_cents: number | null;
  included_branches: number | null;
  max_branches: number | null;
  extra_branch_cents: number | null;
};

export type FleetCatalog = { plans: CatalogPlan[]; acquisition: Record<Tier, number> };

const FALLBACK: FleetCatalog = {
  plans: [
    { tier: "starter", base_cents: 5900, included_cars: 3, max_cars: 10, extra_car_cents: 1299, volume_from: null, volume_car_cents: null, included_branches: 1, max_branches: 2, extra_branch_cents: 2499 },
    { tier: "growth", base_cents: 12500, included_cars: 5, max_cars: null, extra_car_cents: 1999, volume_from: 16, volume_car_cents: 1699, included_branches: 2, max_branches: 4, extra_branch_cents: 1999 },
    { tier: "enterprise", base_cents: 17500, included_cars: 7, max_cars: null, extra_car_cents: 2799, volume_from: 16, volume_car_cents: 2399, included_branches: null, max_branches: null, extra_branch_cents: null },
  ],
  acquisition: { starter: 15000, growth: 20000, enterprise: 30000 },
};

/** The catalog from the database (cached an hour), or the fallback. */
export async function getFleetCatalog(): Promise<FleetCatalog> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/public_pricing_catalog`, {
      method: "POST",
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, "Content-Type": "application/json" },
      body: "{}",
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return FALLBACK;
    const c = (await res.json()) as {
      plans?: CatalogPlan[];
      acquisition?: { tier: Tier; cents: number; service: string }[];
    };
    const plans = (c.plans ?? []).filter((p) => ["starter", "growth", "enterprise"].includes(p.tier));
    if (plans.length !== 3) return FALLBACK;
    // Same price for every service; take the general one (or the first).
    const acq = { ...FALLBACK.acquisition };
    for (const a of c.acquisition ?? []) if (a.service === "general") acq[a.tier] = a.cents;
    const order: Tier[] = ["starter", "growth", "enterprise"];
    return { plans: order.map((t) => plans.find((p) => p.tier === t)!), acquisition: acq };
  } catch {
    return FALLBACK;
  }
}

/** Generic fleet plans (no service named): price, what is included, and the acquisition line. */
export function genericFleetPlans(t: T, tp: T, cat: FleetCatalog): Plan[] {
  const feats: Record<Tier, string[]> = {
    starter: ["rosters", "gpsPerDriver", "odometerVerification", "portalAnyDriver", "dvir", "fuelMaintenance"].map((k) => tp(`features.${k}`)),
    growth: ["everythingStarter", "liveMap", "routesGeofences", "assignmentModes", "fleetExport", "activityLog", "safetyScores", "fuelAlerts", "shiftScheduling"].map((k) =>
      tp(`features.${k}`),
    ),
    enterprise: ["everythingGrowth", "onboarding", "prioritySupport"].map((k) => tp(`features.${k}`)),
  };
  const tiers = cat.plans.map((p) => {
    const lines = [t("pricing.carsIncluded", { n: p.included_cars })];
    if (p.max_cars != null) lines.push(t("pricing.maxCars", { n: p.max_cars }));
    lines.push(t("pricing.extraCar", { price: usd(p.extra_car_cents) }));
    if (p.volume_car_cents != null && p.volume_from != null) {
      lines.push(t("pricing.extraCarVolume", { price: usd(p.volume_car_cents), n: p.volume_from }));
    }
    if (p.max_branches == null) lines.push(t("pricing.branchesUnlimited"));
    else {
      lines.push(
        t("pricing.branches", { n: p.included_branches ?? 0, max: p.max_branches, price: usd(p.extra_branch_cents ?? 0) }),
      );
    }
    return {
      name: tp(`plans.${p.tier}Name`),
      price: usd(p.base_cents),
      unit: t("pricing.perMonth"),
      tagline: tp(`plans.${p.tier}Tagline`),
      features: [...lines, ...feats[p.tier]],
      acquisition: t("pricing.acquisition", { price: usd(cat.acquisition[p.tier]) }),
      cta: { label: t("hero.ctaPrimary"), href: "/signup" },
      highlight: p.tier === "growth",
    };
  });
  // Fourth card: a quoted, custom integration (contact by email).
  const custom: Plan = {
    name: t("pricing.customName"),
    price: t("pricing.customPrice"),
    unit: "",
    tagline: t("pricing.customTagline"),
    features: [t("pricing.customF1"), t("pricing.customF2"), t("pricing.customF3")],
    acquisition: t("pricing.customAcq"),
    cta: { label: t("pricing.customCta"), href: "mailto:info@controlmiles.com?subject=CMFleet%20custom%20integration" },
  };
  return [...tiers, custom];
}
