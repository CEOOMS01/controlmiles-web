"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { startFleetCheckout, openFleetBillingPortal } from "./billing-actions";

type Tier = "starter" | "growth";

const TIER_LABEL: Record<Tier, string> = { starter: "Starter", growth: "Growth" };
const TIER_PRICE: Record<Tier, string> = { starter: "$12.99", growth: "$19.99" };

export function BillingSection({
  orgId,
  vehicleCount,
  currentTier,
  currentStatus,
  billedVehicles,
}: {
  orgId: string;
  vehicleCount: number;
  currentTier: "starter" | "growth" | null;
  currentStatus: string | null;
  billedVehicles: number | null;
}) {
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
      <div className="rounded-xl border border-border bg-surface p-5">
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
    <div className="grid gap-3 sm:grid-cols-2">
      {(["starter", "growth"] as Tier[]).map((tier) => (
        <div key={tier} className="rounded-xl border border-border bg-surface p-5">
          <p className="text-sm font-semibold">{TIER_LABEL[tier]}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {TIER_PRICE[tier]}
            <span className="text-sm font-normal text-muted"> / vehicle / mo</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {vehicleCount} vehicle{vehicleCount === 1 ? "" : "s"} on file today
          </p>
          <button
            onClick={() => subscribe(tier)}
            disabled={pending || vehicleCount === 0}
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
