import { createClient } from "@/lib/supabase/server";
import { daysAgoIso } from "@/lib/dates";

// Driver safety events -- harsh braking / hard acceleration / speeding,
// detected client-side in the ControlMiles mobile app from GPS ticks
// already flowing through Fleet trip tracking (see
// lib/tracking/driver_safety_monitor.dart in the controlmiles repo).
// Read-only here, same as Reviews -- drivers never see or manage these,
// only the org admin does. RLS (driver_safety_events_select) is the real
// gate: is_org_admin_or_owner(organization_id), not this page's own
// query filter alone.

const EVENT_LABELS: Record<string, string> = {
  harsh_braking: "Harsh braking",
  hard_acceleration: "Hard acceleration",
  speeding: "Speeding",
};

function driverName(p: { first_name: string | null; last_name: string | null } | null) {
  if (!p) return "—";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "—";
}

function vehicleLabel(v: { nickname: string | null; make: string | null; model: string | null; display_id: string | null } | null) {
  if (!v) return "—";
  const name = [v.make, v.model].filter(Boolean).join(" ");
  return v.display_id ? `${name || v.nickname || "Vehicle"} (${v.display_id})` : name || v.nickname || "—";
}

function speedLabel(speedMps: number | null) {
  if (speedMps == null) return "—";
  return `${Math.round(speedMps * 2.23694)} mph`;
}

export default async function SafetyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_org_id")
    .eq("id", user.id)
    .maybeSingle();
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const thirtyDaysAgo = daysAgoIso(30);

  const { data: events } = await supabase
    .from("driver_safety_events")
    .select(
      "id, event_type, speed_mps, recorded_at, profiles(first_name, last_name), vehicles(nickname, make, model, display_id)",
    )
    .eq("organization_id", orgId)
    .gte("recorded_at", thirtyDaysAgo)
    .order("recorded_at", { ascending: false })
    .limit(100);

  const rows = events ?? [];
  const harshBrakingCount = rows.filter((e) => e.event_type === "harsh_braking").length;
  const hardAccelCount = rows.filter((e) => e.event_type === "hard_acceleration").length;
  const speedingCount = rows.filter((e) => e.event_type === "speeding").length;

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          Safety
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Driver safety events</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Harsh braking, hard acceleration, and speeding, detected
          automatically from GPS during tracked trips — no extra hardware.
          Last 30 days. Speeding uses a fixed threshold, not per-road speed
          limits.
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs text-muted">Harsh braking</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{harshBrakingCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs text-muted">Hard acceleration</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{hardAccelCount}</p>
        </div>
        <div className={`rounded-xl border p-5 ${speedingCount > 0 ? "border-danger/40 bg-danger/5" : "border-border bg-surface"}`}>
          <p className="text-xs text-muted">Speeding</p>
          <p className={`mt-1 text-3xl font-semibold tabular-nums ${speedingCount > 0 ? "text-danger" : ""}`}>
            {speedingCount}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((e) => {
          const p = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
          const v = Array.isArray(e.vehicles) ? e.vehicles[0] : e.vehicles;
          const isSpeeding = e.event_type === "speeding";

          return (
            <div
              key={e.id}
              className={`rounded-xl border bg-surface p-4 ${isSpeeding ? "border-danger/40" : "border-border"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{driverName(p)}</p>
                  <p className="text-xs text-muted">
                    {vehicleLabel(v)} · {speedLabel(e.speed_mps)} ·{" "}
                    {new Date(e.recorded_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    isSpeeding ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning"
                  }`}
                >
                  {EVENT_LABELS[e.event_type] ?? e.event_type}
                </span>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
            No safety events in the last 30 days.
          </p>
        )}
      </div>
    </main>
  );
}
