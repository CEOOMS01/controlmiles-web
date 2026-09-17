import Link from "next/link";

// Explicit user requirement (2026-09-18): page-level gating for the three
// Growth-only web surfaces (Activity log, Export, live map) -- before
// this, a Starter org either saw a raw Postgres exception (Export) or a
// silently empty page (Activity: RLS just filtered geofences-style rows
// down to nothing; live map: getRealtimeAccessToken returned null with
// no explanation). Same fn_org_effective_tier the RLS/RPC layer already
// uses, checked server-side here too so the page never even attempts the
// gated query -- this component is the one place all three pages render
// the same "here's what you're missing, here's how to get it" instead of
// three different half-broken states.
export function GrowthUpsell({ feature }: { feature: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-8 text-center">
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">
        Growth plan
      </p>
      <h2 className="mt-2 text-lg font-semibold">{feature} needs the Growth plan</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Your organization is on Starter (or its trial). Upgrade to Growth to
        unlock {feature.toLowerCase()}, DVIR, geofencing, and the live map.
      </p>
      <Link
        href="/admin/settings"
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
      >
        Upgrade to Growth
      </Link>
    </div>
  );
}
