// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/fleet-plans.ts
//
// Fleet and driving school plans, shared by /pricing and /fleet (CMFleet,
// 2026-10-20) so the two pages can never show different prices or bullets.
// Every bullet maps to a feature that plan really has (fn_org_features).

import type { getTranslations } from "next-intl/server";
import { SCHOOL_TIER_PRICE } from "@/lib/school-pricing";

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

export const fleetPlans = (t: T): Plan[] => [
  {
    name: t("plans.starterName"),
    price: "$12.99",
    unit: t("perVehicle"),
    tagline: t("plans.starterTagline"),
    features: [
      t("features.rosters"),
      t("features.gpsPerDriver"),
      t("features.odometerVerification"),
      t("features.portalAnyDriver"),
      t("features.revocation"),
      t("features.dvir"),
      t("features.fuelMaintenance"),
      t("features.serviceStarter"),
    ],
    cta: { label: t("signInFleet"), href: "/login" },
  },
  {
    name: t("plans.growthName"),
    price: "$19.99",
    unit: t("perVehicle"),
    tagline: t("plans.growthTagline"),
    features: [
      t("features.everythingStarter"),
      t("features.liveMap"),
      t("features.routesGeofences"),
      t("features.assignmentModes"),
      t("features.fleetExport"),
      t("features.activityLog"),
      t("features.safetyScores"),
      t("features.fuelAlerts"),
      t("features.shiftScheduling"),
      t("features.serviceGrowth"),
    ],
    cta: { label: t("signInFleet"), href: "/login" },
    highlight: true,
  },
  {
    name: t("plans.enterpriseName"),
    price: t("plans.enterprisePrice"),
    unit: t("perVehicle"),
    tagline: t("plans.enterpriseTagline"),
    features: [
      t("features.everythingGrowth"),
      t("features.onboarding"),
      t("features.customReporting"),
      t("features.prioritySupport"),
    ],
    cta: { label: t("signInFleet"), href: "/login" },
  },
];

// Driving schools (2026-10-20): their own prices and branch allowance
// (src/lib/school-pricing.ts); every line maps to a feature of that plan.
export const schoolPlans = (t: T): Plan[] => [
  {
    name: t("plans.starterName"),
    price: SCHOOL_TIER_PRICE.starter,
    unit: t("perVehicle"),
    tagline: t("school.starterTagline"),
    features: [t("school.fleetBasics"), t("school.dvir"), t("school.liveMap"), t("school.branchStarter")],
    cta: { label: t("signInFleet"), href: "/login" },
  },
  {
    name: t("plans.growthName"),
    price: SCHOOL_TIER_PRICE.growth,
    unit: t("perVehicle"),
    tagline: t("school.growthTagline"),
    features: [
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
    price: SCHOOL_TIER_PRICE.enterprise,
    unit: t("perVehicle"),
    tagline: t("school.enterpriseTagline"),
    features: [
      t("school.everythingGrowth"),
      t("school.reportCards"),
      t("school.portal"),
      t("school.reminders"),
      t("school.packages"),
      t("school.certificates"),
      t("school.branchEnterprise"),
      t("school.support"),
    ],
    cta: { label: t("signInFleet"), href: "/login" },
  },
];
