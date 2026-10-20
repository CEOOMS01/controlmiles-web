"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { startFleetCheckout, openFleetBillingPortal } from "./billing-actions";
import { SCHOOL_BRANCHES, SCHOOL_TIER_PRICE, schoolBranchLine, type Tier } from "@/lib/school-pricing";

const TIER_LABEL: Record<Tier, string> = { starter: "Starter", growth: "Growth", enterprise: "Enterprise" };
const FLEET_TIER_PRICE: Record<Tier, string> = { starter: "$12.99", growth: "$19.99", enterprise: "$27.99" };

export function BillingSection({
  orgId,
  vehicleCount,
  currentTier,
  currentStatus,
  billedVehicles,
  showEnterprise = false,
  schoolBranches = null,
}: {
  orgId: string;
  vehicleCount: number;
  currentTier: Tier | null;
  // Enterprise is self-serve where it has features of its own (driving
  // schools: students' report cards, portal, reminders, packages,
  // certificates); elsewhere it stays "Contact us".
  showEnterprise?: boolean;
  currentStatus: string | null;
  billedVehicles: number | null;
  // Driving schools (2026-10-20): their own prices, and branches beyond the
  // plan's included ones are billed (src/lib/school-pricing.ts). The active
  // branch count; null for other services.
  schoolBranches?: number | null;
}) {
  const isSchool = schoolBranches != null;
  const TIER_PRICE = isSchool ? SCHOOL_TIER_PRICE : FLEET_TIER_PRICE;
  const extrasOn = (tier: Tier) => {
    const b = SCHOOL_BRANCHES[tier];
    return b && isSchool ? Math.min(Math.max(schoolBranches - b.included, 0), b.max - b.included) : 0;
  };
  const tooMany = (tier: Tier) => {
    const b = SCHOOL_BRANCHES[tier];
    return !!b && isSchool && schoolBranches > b.max;
  };
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Stripe returns here with ?billing=success|canceled. The plan itself is
  // switched on by stripe-webhook, usually within a few seconds.
  const billingReturn = useSearchParams().get("billing");
  const isActive = currentStatus === "active" || currentStatus === "trialing" || currentStatus === "past_due";
  const returnNotice =
    billingReturn === "success" && !isActive ? (
      <p className="mb-3 rounded-lg border border-border bg-surface px-4 py-3 text-xs text-muted">
        Payment received. Your plan activates in a few seconds — refresh this page if it doesn&apos;t show yet.
      </p>
    ) : billingReturn === "canceled" ? (
      <p className="mb-3 rounded-lg border border-border bg-surface px-4 py-3 text-xs text-muted">
        Checkout was canceled. You weren&apos;t charged.
      </p>
    ) : null;

  function subscribe(tier: Tier) {
    setError(null);
    startTransition(async () => {
      const result = await startFleetCheckout(orgId, tier);
      if (result.error) {
        setError(result.error);
      } else if (result.url) {
        window.location.href = result.url;
      }
    });
  }

  function manage() {
    setError(null);
    startTransition(async () => {
      const result = await openFleetBillingPortal(orgId);
      if (result.error) {
        setError(result.error);
      } else if (result.url) {
        window.location.href = result.url;
      }
    });
  }

  if (isActive && currentTier) {
    return (
      <div>
        {currentStatus === "past_due" && (
          <p className="mb-3 text-xs text-danger">
            Your last payment didn&apos;t go through. Update your card in Manage billing to keep your plan.
          </p>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">
              {TIER_LABEL[currentTier]} — {TIER_PRICE[currentTier]}/vehicle
            </p>
            <p className="mt-1 text-xs text-muted">
              {vehicleCount} vehicle{vehicleCount === 1 ? "" : "s"} on file · billed via Stripe
              {billedVehicles != null && billedVehicles !== Math.max(vehicleCount, 1) && (
                <> · currently billed for {billedVehicles}; your next invoice uses your vehicle count</>
              )}
            </p>
            {isSchool && (
              <p className="mt-1 text-xs text-muted">
                {SCHOOL_BRANCHES[currentTier]
                  ? `${schoolBranches} ${schoolBranches === 1 ? "branch" : "branches"} · ${schoolBranchLine(currentTier)}${
                      extrasOn(currentTier) > 0
                        ? ` · ${extrasOn(currentTier)} extra billed at ${SCHOOL_BRANCHES[currentTier]!.extra}/mo`
                        : ""
                    }`
                  : "Unlimited branches included"}
              </p>
            )}
          </div>
          <button
            onClick={manage}
            disabled={pending}
            className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-60"
          >
            {pending ? "Opening…" : "Manage billing"}
          </button>
        </div>
        {error && <p className="mt-3 text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div>
    {returnNotice}
    <div className={`grid gap-3 ${showEnterprise ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {((showEnterprise ? ["starter", "growth", "enterprise"] : ["starter", "growth"]) as Tier[]).map((tier) => (
        <div key={tier} className="rounded-xl border border-border bg-surface p-5">
          <p className="text-sm font-semibold">{TIER_LABEL[tier]}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {TIER_PRICE[tier]}
            <span className="text-sm font-normal text-muted"> / vehicle / mo</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {vehicleCount} vehicle{vehicleCount === 1 ? "" : "s"} on file today
          </p>
          {isSchool && (
            <p className="mt-2 text-xs text-muted">
              {schoolBranchLine(tier)}
              {extrasOn(tier) > 0 && !tooMany(tier) && (
                <span className="block text-foreground">
                  You have {schoolBranches} branches: +{extrasOn(tier)} × {SCHOOL_BRANCHES[tier]!.extra}/mo
                </span>
              )}
              {tooMany(tier) && (
                <span className="block text-danger">
                  You have {schoolBranches} branches; this plan allows {SCHOOL_BRANCHES[tier]!.max}.
                </span>
              )}
            </p>
          )}
          <button
            onClick={() => subscribe(tier)}
            disabled={pending || vehicleCount === 0 || tooMany(tier)}
            className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Starting…" : `Subscribe to ${TIER_LABEL[tier]}`}
          </button>
        </div>
      ))}
      {vehicleCount === 0 && (
        <p className="sm:col-span-2 text-xs text-muted">Add a vehicle first — billing scales with your fleet.</p>
      )}
      {error && <p className="sm:col-span-2 text-xs text-danger">{error}</p>}
    </div>
    </div>
  );
}
