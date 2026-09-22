import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { GrowthUpsell } from "../growth-upsell";

// Real fix, not a pricing-copy edit (explicit user request, 2026-09-18):
// the pricing page has promised a Growth-tier "activity log... protected
// against edits" since it shipped, but no admin-visible feature ever
// existed for it -- audit_events (the real hash-chained, tamper-evident
// table this claim describes -- see AuditService.logAuditEvent in the
// mobile app, prevHash/hash chaining) was never queried from anywhere in
// this web app. This page is that feature, not a cosmetic gap-filler:
// real org-scoped data, RLS-gated (audit_select policy already allows any
// org member to read audit_events for their org -- confirmed live before
// building this, no policy change needed).
//
// GPS_TICK excluded on purpose: it's the single largest event type by a
// wide margin (thousands of rows/day per active driver) and carries no
// information an admin would ever act on -- a real "activity log" means
// the events a human recognizes as something happening (a trip started,
// paused, an odometer captured), not raw telemetry. Everything else is
// shown, unfiltered, so the "protected against edits" claim is visibly
// true: the hash-chain fields are real and shown, not summarized away.

const EVENT_LABELS: Record<string, string> = {
  SECTION_START: "Trip started",
  SECTION_SWITCHED: "Switched gig app mid-trip",
  TRACKING_PAUSED: "Trip paused",
  TRACKING_RESUMED: "Trip resumed",
  ODOMETER_START: "Odometer captured (start)",
  ODOMETER_END: "Odometer captured (end)",
};

function driverName(p: { first_name: string | null; last_name: string | null } | null) {
  if (!p) return "—";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "—";
}

export default async function ActivityPage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  // Page-level Growth gate (explicit user requirement, 2026-09-18):
  // mirrors the same fn_org_effective_tier the RLS/RPC layer already
  // enforces for geofencing/DVIR -- checked here too so a Starter org
  // sees a real upsell instead of just an empty-looking activity log
  // (audit_events itself has no tier-scoped RLS; nothing here was ever
  // technically broken, just uninformative).
  const { data: tier } = await supabase.rpc("fn_org_effective_tier", { p_org_id: orgId });
  if (tier !== "growth" && tier !== "enterprise") {
    return (
      <main className="px-6 py-10 sm:px-10">
        <div className="mb-8">
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">Activity</p>
          <h1 className="mt-1 text-2xl font-semibold">Activity log</h1>
        </div>
        <GrowthUpsell feature="Activity log" />
      </main>
    );
  }

  const { data: events } = await supabase
    .from("audit_events")
    .select("id, event_type, created_at, hash, prev_hash, profiles(first_name, last_name)")
    .eq("organization_id", orgId)
    .neq("event_type", "GPS_TICK")
    .order("created_at", { ascending: false })
    .limit(150);

  const rows = events ?? [];

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          Activity
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Activity log</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Every trip start, pause, resume, gig-app switch, and odometer capture
          across your fleet — each event is hash-chained to the one before it,
          so a change made after the fact would break the chain. Raw GPS pings
          are excluded; this is what actually happened, not telemetry noise.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Driver</th>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Chain hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const p = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
              return (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{driverName(p)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                      {EVENT_LABELS[e.event_type] ?? e.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {e.hash ? `${e.hash.slice(0, 10)}…` : "—"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  No activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
