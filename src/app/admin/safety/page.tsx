import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { daysAgoIso } from "@/lib/dates";
import { driverLabel, fleetDriverIds } from "@/lib/driver-label";
import { EVENT_POINTS, fleetScore, grade, lastWeeks, MIN_MILES_TO_RATE, type ScoreRow } from "@/lib/safety-score";

// Driver safety -- scorecard + events (scorecard added 2026-09-30,
// explicit user request, modelled on Samsara's / Motive's driver safety
// score). Events are harsh braking / hard acceleration / speeding,
// detected in the ControlMiles app from the trip's GPS (see
// lib/tracking/driver_safety_monitor.dart in the controlmiles repo); the
// score is computed in the database (driver_safety_scores). RLS
// (driver_safety_events_select: is_org_admin_or_owner) is the real gate
// on the events feed.
//
// Speeding is checked against the real posted limit (OpenStreetMap) when
// it's available, falling back to a fixed ~75 mph threshold where it
// isn't -- and only speeds over ~75 mph are candidates today (see the
// note on the page).

const EVENT_LABELS: Record<string, string> = {
  harsh_braking: "Harsh braking",
  hard_acceleration: "Hard acceleration",
  speeding: "Speeding",
};

function vehicleLabel(v: { nickname: string | null; make: string | null; model: string | null; display_id: string | null } | null) {
  if (!v) return "—";
  const name = [v.make, v.model].filter(Boolean).join(" ");
  return v.display_id ? `${name || v.nickname || "Vehicle"} (${v.display_id})` : name || v.nickname || "—";
}

function speedLabel(speedMps: number | null) {
  if (speedMps == null) return "—";
  return `${Math.round(speedMps * 2.23694)} mph`;
}

const PERIOD_DAYS = 30;
const TREND_WEEKS = 8;

export default async function SafetyPage({
  searchParams,
}: {
  searchParams: Promise<{ driver?: string | string[] }>;
}) {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const requestedDriver = (await searchParams).driver;
  const driverFilter = typeof requestedDriver === "string" && /^[0-9a-f-]{36}$/.test(requestedDriver) ? requestedDriver : null;

  const today = daysAgoIso(0).slice(0, 10);
  const periodStart = daysAgoIso(PERIOD_DAYS - 1).slice(0, 10);
  const prevStart = daysAgoIso(PERIOD_DAYS * 2 - 1).slice(0, 10);
  const prevEnd = daysAgoIso(PERIOD_DAYS).slice(0, 10);
  const weeks = lastWeeks(new Date(`${today}T12:00:00Z`), TREND_WEEKS);

  let eventsQuery = supabase
    .from("driver_safety_events")
    .select(
      "id, user_id, event_type, speed_mps, speed_limit_mps, speed_limit_source, latitude, longitude, recorded_at, profiles(first_name, last_name), vehicles(nickname, make, model, display_id)",
    )
    .eq("organization_id", orgId)
    .gte("recorded_at", daysAgoIso(PERIOD_DAYS))
    .order("recorded_at", { ascending: false })
    .limit(100);
  if (driverFilter) eventsQuery = eventsQuery.eq("user_id", driverFilter);

  const [fleetIds, { data: current }, { data: previous }, { data: weekly }, { data: members }, { data: events }] =
    await Promise.all([
      fleetDriverIds(supabase, orgId),
      supabase.rpc("driver_safety_scores", { p_organization_id: orgId, p_start_date: periodStart, p_end_date: today }),
      supabase.rpc("driver_safety_scores", { p_organization_id: orgId, p_start_date: prevStart, p_end_date: prevEnd }),
      supabase.rpc("driver_safety_scores", {
        p_organization_id: orgId,
        p_start_date: weeks[0],
        p_end_date: today,
        p_bucket: "week",
      }),
      supabase.from("organization_members").select("user_id, profiles(first_name, last_name)").eq("organization_id", orgId),
      eventsQuery,
    ]);

  const nameByUser = new Map(
    (members ?? []).map((m) => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return [m.user_id as string, driverLabel(p, fleetIds.get(m.user_id as string))];
    }),
  );

  const rows = ((current ?? []) as ScoreRow[]).map((r) => ({ ...r, miles: Number(r.miles), score: r.score == null ? null : Number(r.score) }));
  const prevByUser = new Map(((previous ?? []) as ScoreRow[]).map((r) => [r.user_id, r.score == null ? null : Number(r.score)]));
  const weeklyByUser = new Map<string, Map<string, number | null>>();
  for (const w of (weekly ?? []) as ScoreRow[]) {
    if (!weeklyByUser.has(w.user_id)) weeklyByUser.set(w.user_id, new Map());
    weeklyByUser.get(w.user_id)!.set(w.bucket_start, w.score == null ? null : Number(w.score));
  }

  // Worst first -- the scorecard is for coaching; unrated at the end.
  rows.sort((a, b) => (a.score ?? 1000) - (b.score ?? 1000) || b.miles - a.miles);

  const totalMiles = rows.reduce((s, r) => s + r.miles, 0);
  const totalPoints = rows.reduce((s, r) => s + r.points, 0);
  const totals = {
    harsh_braking: rows.reduce((s, r) => s + r.harsh_braking, 0),
    hard_acceleration: rows.reduce((s, r) => s + r.hard_acceleration, 0),
    speeding: rows.reduce((s, r) => s + r.speeding, 0),
  };
  const fleet = fleetScore(totalPoints, totalMiles);
  const rated = rows.filter((r) => r.score != null);
  const perHundred = (n: number, miles: number) => (miles > 0 ? ((n * 100) / miles).toFixed(1) : "—");

  const feed = events ?? [];

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Safety</p>
        <h1 className="mt-1 text-2xl font-semibold">Driver scorecard</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          A 0–100 score per driver for the last {PERIOD_DAYS} days, from harsh braking, hard acceleration
          and speeding per 100 miles driven — detected from the phone&apos;s GPS during trips, no extra
          hardware.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <div className={`col-span-2 rounded-xl border px-5 py-4 lg:col-span-1 ${fleet != null ? "border-accent/30 bg-accent/10" : "border-border bg-surface"}`}>
          <p className="text-xs font-medium text-muted">Fleet score</p>
          <p className="mt-1 font-mono text-3xl font-bold text-accent tabular-nums">{fleet ?? "—"}</p>
          <p className="mt-0.5 text-xs text-muted">{grade(fleet).label}</p>
        </div>
        <Stat label="Drivers rated" value={`${rated.length} of ${rows.length}`} />
        <Stat label="Events / 100 mi" value={perHundred(totals.harsh_braking + totals.hard_acceleration + totals.speeding, totalMiles)} />
        <Stat label="Harsh braking" value={String(totals.harsh_braking)} />
        <Stat label="Hard acceleration" value={String(totals.hard_acceleration)} />
        <Stat label="Speeding" value={String(totals.speeding)} danger={totals.speeding > 0} />
      </div>

      <section className="mb-10">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
            No fleet trips in the last {PERIOD_DAYS} days yet. Scores appear once drivers track trips.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-right text-xs text-muted">
                  <th className="px-4 py-3 text-left font-medium">Driver</th>
                  <th className="px-4 py-3 text-left font-medium">Score</th>
                  <th className="px-4 py-3 text-left font-medium">{TREND_WEEKS}-week trend</th>
                  <th className="px-4 py-3 font-medium">vs prior {PERIOD_DAYS} d</th>
                  <th className="px-4 py-3 font-medium">Miles</th>
                  <th className="px-4 py-3 font-medium">Braking</th>
                  <th className="px-4 py-3 font-medium">Accel.</th>
                  <th className="px-4 py-3 font-medium">Speeding</th>
                  <th className="px-4 py-3 font-medium">Per 100 mi</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r) => {
                  const g = grade(r.score);
                  const prev = prevByUser.get(r.user_id) ?? null;
                  const delta = r.score != null && prev != null ? r.score - prev : null;
                  const series = weeks.map((w) => weeklyByUser.get(r.user_id)?.get(w) ?? null);
                  return (
                    <tr key={r.user_id} className="border-b border-border text-right last:border-0">
                      <td className="px-4 py-2.5 text-left">
                        <Link href={`/admin/safety?driver=${r.user_id}#events`} className="hover:text-accent hover:underline">
                          {nameByUser.get(r.user_id) ?? "Former member"}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-left whitespace-nowrap">
                        <span className="mr-2 font-mono text-lg font-bold">{r.score ?? "—"}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${g.badge}`}>{g.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-left">
                        <Sparkline values={series} stroke={g.stroke} />
                      </td>
                      <td
                        className={`px-4 py-2.5 font-mono ${
                          delta == null ? "text-muted" : delta > 0 ? "text-emerald-600 dark:text-emerald-400" : delta < 0 ? "text-danger" : ""
                        }`}
                      >
                        {delta == null ? "—" : delta > 0 ? `+${delta}` : String(delta)}
                      </td>
                      <td className="px-4 py-2.5 font-mono">{Math.round(r.miles).toLocaleString("en-US")}</td>
                      <td className="px-4 py-2.5 font-mono">{r.harsh_braking}</td>
                      <td className="px-4 py-2.5 font-mono">{r.hard_acceleration}</td>
                      <td className={`px-4 py-2.5 font-mono ${r.speeding > 0 ? "text-danger" : ""}`}>{r.speeding}</td>
                      <td className="px-4 py-2.5 font-mono">
                        {perHundred(r.harsh_braking + r.hard_acceleration + r.speeding, r.miles)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <details className="mt-3 text-sm text-muted">
          <summary className="cursor-pointer font-medium">How the score works</summary>
          <div className="mt-2 max-w-3xl space-y-2">
            <p>
              Each event adds points: harsh braking {EVENT_POINTS.harsh_braking}, hard acceleration{" "}
              {EVENT_POINTS.hard_acceleration}, speeding {EVENT_POINTS.speeding}. The score is 100 minus the
              points per 100 miles driven, so drivers who drive more aren&apos;t penalized for it. A driver with
              under {MIN_MILES_TO_RATE} miles in the period isn&apos;t rated yet. 90+ Excellent · 75–89 Good ·
              60–74 Needs coaching · under 60 At risk.
            </p>
            <p>
              Harsh braking and hard acceleration are changes in speed of 3.5 m/s² or more. Speeding is logged
              above about 75 mph, or 10% over the posted limit when the road&apos;s limit is known. Speeding on
              slower roads (for example 50 in a 30 zone) isn&apos;t detected yet.
            </p>
          </div>
        </details>
      </section>

      <section id="events">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Events{driverFilter && ` — ${nameByUser.get(driverFilter) ?? "driver"}`}
          </h2>
          {driverFilter && (
            <Link href="/admin/safety#events" className="text-sm text-accent hover:underline">
              Show all drivers
            </Link>
          )}
        </div>
        <div className="space-y-3">
          {feed.map((e) => {
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
                    <p className="text-sm font-semibold">{driverLabel(p, fleetIds.get(e.user_id))}</p>
                    <p className="text-xs text-muted">
                      {vehicleLabel(v)} · {speedLabel(e.speed_mps)}
                      {isSpeeding && e.speed_limit_source === "osm" && <> in a {speedLabel(e.speed_limit_mps)} zone</>}
                      {isSpeeding && e.speed_limit_source === "fixed_fallback" && <> (posted limit unknown here)</>} ·{" "}
                      {new Date(e.recorded_at).toLocaleString("en-US")}
                      {e.latitude != null && e.longitude != null && (
                        <>
                          {" "}·{" "}
                          <a
                            href={`https://www.google.com/maps?q=${e.latitude},${e.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent hover:underline"
                          >
                            Map
                          </a>
                        </>
                      )}
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
          {feed.length === 0 && (
            <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
              No safety events in the last {PERIOD_DAYS} days.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${danger ? "border-danger/40 bg-danger/5" : "border-border bg-surface"}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 font-mono text-xl font-bold tabular-nums ${danger ? "text-danger" : ""}`}>{value}</p>
    </div>
  );
}

/** Weekly scores as a tiny line; weeks without enough driving are gaps. */
function Sparkline({ values, stroke }: { values: (number | null)[]; stroke: string }) {
  const w = 96;
  const h = 24;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const y = (v: number) => h - 2 - (v / 100) * (h - 4);
  const segments: string[] = [];
  let current = "";
  values.forEach((v, i) => {
    if (v == null) {
      if (current) segments.push(current);
      current = "";
      return;
    }
    current += `${current ? "L" : "M"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`;
  });
  if (current) segments.push(current);
  const dots = values
    .map((v, i) => (v == null ? null : { x: i * step, y: y(v) }))
    .filter((d): d is { x: number; y: number } => d !== null);
  if (dots.length === 0) return <span className="text-xs text-muted">—</span>;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Weekly score trend" role="img">
      <line x1="0" x2={w} y1={y(90)} y2={y(90)} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="2 2" />
      {segments.map((d) => (
        <path key={d} d={d} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
      ))}
      <circle cx={dots[dots.length - 1].x} cy={dots[dots.length - 1].y} r="2.2" fill={stroke} />
    </svg>
  );
}
