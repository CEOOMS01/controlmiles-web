// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/fleet-plans.ts
//
// Fleet and driving school plans, shared by /pricing and /fleet (CMFleet,
// 2026-10-20) so the two pages can never show different prices or bullets.
// Every bullet maps to a feature that plan really has (fn_org_features).

import type { getTranslations } from "next-intl/server";
import { SCHOOL_RATES, usd } from "@/lib/school-pricing";

/** A translator for the "pricing" namespace. */
type T = Awaited<ReturnType<typeof getTranslations>>;

export type Plan = {
  name: string;
  price: string;
  unit: string;
  tagline: string;
  features: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
};

// Driving schools (2026-10-20): a base with 3 cars, then per car, and a branch allowance
// (src/lib/school-pricing.ts); every line maps to a feature of that plan.
export const schoolPlans = (t: T): Plan[] => [
  {
    name: t("plans.starterName"),
    price: usd(SCHOOL_RATES.starter.base),
    unit: t("school.unit"),
    tagline: t("school.starterTagline"),
    features: [t("school.carsStarter"), t("school.fleetBasics"), t("school.dvir"), t("school.liveMap"), t("school.branchStarter")],
    cta: { label: t("signInFleet"), href: "/login" },
  },
  {
    name: t("plans.growthName"),
    price: usd(SCHOOL_RATES.growth.base),
    unit: t("school.unit"),
    tagline: t("school.growthTagline"),
    features: [
      t("school.carsGrowth"),
      t("school.everythingStarter"),
      t("school.classes"),
      t("school.students"),
      t("school.safety"),
      t("school.export"),
      t("school.branchGrowth"),
    ],
    cta: { label: t("signInFleet"), href: "/login" },
    highlight: true,
  },
  {
    name: t("plans.enterpriseName"),
    price: usd(SCHOOL_RATES.enterprise.base),
    unit: t("school.unit"),
    tagline: t("school.enterpriseTagline"),
    features: [
      t("school.carsEnterprise"),
      t("school.everythingGrowth"),
      t("school.reportCards"),
      t("school.portal"),
      t("school.reminders"),
      t("school.packages"),
      t("school.certificates"),
      t("school.branchEnterprise"),
      t("school.ownDomain"),
      t("school.support"),
    ],
    cta: { label: t("signInFleet"), href: "/login" },
  },
];
