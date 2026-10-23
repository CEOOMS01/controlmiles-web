"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { startFleetCheckout, openFleetBillingPortal } from "./billing-actions";
import type { Tier } from "@/lib/school-pricing";

const TIER_LABEL: Record<Tier, string> = { starter: "Starter", growth: "Growth", enterprise: "Enterprise" };

// Billing shows status and the Stripe portal only. Plans and prices live on
// the public CMFleet page (/fleet#pricing, read from the database); none are
// repeated here, so there is a single place to change them.
export function BillingSection({
  orgId,
  vehicleCount,
  currentTier,
  currentStatus,
  billedVehicles,
}: {
  orgId: string;
  vehicleCount: number;
  currentTier: Tier | null;
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
      <div>
        {currentStatus === "past_due" && (
          <p className="mb-3 text-xs text-danger">
            Your last payment didn&apos;t go through. Update your card in Manage billing to keep your plan.
          </p>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{TIER_LABEL[currentTier]}</p>
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
      <p className="mb-3 text-sm text-muted">
        See what each plan includes and what it costs at{" "}
        <a href="/fleet#pricing" target="_blank" rel="noreferrer" className="text-accent hover:underline">
          controlmiles.com/fleet
        </a>
        . The amount is confirmed on the secure Stripe page before you pay.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {(["starter", "growth", "enterprise"] as Tier[]).map((tier) => (
          <button
            key={tier}
            onClick={() => subscribe(tier)}
            disabled={pending || vehicleCount === 0}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Starting…" : `Subscribe to ${TIER_LABEL[tier]}`}
          </button>
        ))}
      </div>
      {vehicleCount === 0 && <p className="mt-3 text-xs text-muted">Add a vehicle first — billing follows your fleet.</p>}
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
    </div>
  );
}
