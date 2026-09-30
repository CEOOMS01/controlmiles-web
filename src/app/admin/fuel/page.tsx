import { createClient } from "@/lib/supabase/server";
import { getBranchScope } from "@/lib/branch-scope";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { driverLabel, fleetDriverIds } from "@/lib/driver-label";
import {
  addIdle,
  emptyTotals,
  FALLBACK_PRICE_PER_GALLON,
  formatMinutes,
  type IdleEvent,
  type IdleTotals,
} from "@/lib/idle";
import { AnomalyReview, FuelAlertsLive, PeriodPicker, TankCapacityInput } from "./fuel-controls";

// Fuel -- consumption, cost and anomaly alerts (2026-09-30, explicit user
// request after reviewing Control IMS: their "consumption anomaly alerts"
// and per-asset fuel efficiency, done here with the driver's receipt +
// the phone's trips instead of engine hardware). The checks run in the
// database (fn_evaluate_fuel_purchase) the moment a receipt is logged and
// nightly; this page is where an admin reviews them, and the nightly
// email (send-fuel-alerts) links here.

const KIND_LABEL: Record<string, string> = {
  duplicate: "Possible duplicate receipt",
  over_capacity: "More fuel than the tank holds",
  location_mismatch: "Bought where the vehicle wasn’t",
  no_trip: "No trips around the purchase",
  no_miles: "Fill-up with no miles driven",
  low_mpg: "Unusually low MPG",
  price_mismatch: "Receipt total doesn’t add up",
  price_high: "Price well above normal",
};

const SEVERITY_STYLE: Record<string, string> = {
  high: "bg-danger/15 text-danger",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  low: "bg-foreground/10 text-muted",
};

type Vehicle = {
  id: string;
  display_id: string | null;
  nickname: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  fuel_tank_capacity_gal: number | null;
  ifta_qualified: boolean;
  ifta_fuel_type: "diesel" | "gasoline";
};

function vehicleLabel(v: Vehicle | undefined) {
  if (!v) return "—";
  const name = [v.year, v.make, v.model].filter(Boolean).join(" ");
  const label = v.nickname ? `${name} "${v.nickname}"`.trim() : name || v.plate;
  const id = v.display_id ?? v.id.slice(0, 6);
  return label ? `${label} (${id})` : id;
}

/** YYYY-MM-DD, `days` days before now. */
function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const int = (n: number) => Math.round(n).toLocaleString("en-US");

export default async function FuelPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const requested = Number((await searchParams).days);
  const days = [30, 90, 365].includes(requested) ? requested : 90;
  const since = daysAgo(days);

  const [
    { data: vehicleRows },
    { data: purchaseRows },
    { data: sessionRows },
    { data: anomalyRows },
    { data: me },
    { data: idleRows },
    { data: memberRows },
    fleetIds,
  ] = await Promise.all([
      supabase
        .from("vehicles")
        .select("id, display_id, nickname, make, model, year, plate, fuel_tank_capacity_gal, ifta_qualified, ifta_fuel_type")
        .eq("organization_id", orgId)
        .eq("is_archived", false)
        .order("created_at", { ascending: true }),
      supabase
        .from("fuel_purchases")
        .select(
          "id, vehicle_id, user_id, purchase_date, state_code, gallons, fuel_type, price_per_gallon_usd, total_cost_usd, vendor_name, receipt_path",
        )
        .eq("organization_id", orgId)
        .gte("purchase_date", since)
        .order("purchase_date", { ascending: false })
        .limit(500),
      supabase
        .from("sessions")
        .select("vehicle_id, user_id, total_miles, total_duration_seconds")
        .eq("organization_id", orgId)
        .gte("date_key", since)
        .not("vehicle_id", "is", null)
        .limit(20000),
      supabase
        .from("fuel_anomalies")
        .select("id, purchase_id, vehicle_id, kind, severity, detail, status, review_note, reviewed_at, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("organization_members")
        .select("member_role")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.rpc("compute_idle_events", {
        p_organization_id: orgId,
        p_start_date: since,
        p_end_date: daysAgo(0),
      }),
      supabase
        .from("organization_members")
        .select("user_id, profiles(first_name, last_name)")
        .eq("organization_id", orgId),
      fleetDriverIds(supabase, orgId),
    ]);

  const canEdit = me?.member_role === "owner" || me?.member_role === "admin";
  // Branch filter (sidebar, 2026-09-30): only this branch's vehicles.
  const scope = await getBranchScope(orgId);
  const vehicles = ((vehicleRows ?? []) as Vehicle[]).filter((v) => scope.vehicleIn(v.id));
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const purchases = (purchaseRows ?? []).filter((p) => scope.vehicleIn(p.vehicle_id));
  const purchaseById = new Map(purchases.map((p) => [p.id, p]));

  // Receipt photos (the storage policy lets an owner/admin read the
  // receipts logged for this fleet).
  const paths = purchases.map((p) => p.receipt_path).filter((p): p is string => !!p);
  const photoByPath = new Map<string, string>();
  if (canEdit && paths.length > 0) {
    const { data: signed } = await supabase.storage.from("fuel_receipts").createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) photoByPath.set(s.path, s.signedUrl);
  }

  const cost = (p: (typeof purchases)[number]) =>
    p.total_cost_usd != null
      ? Number(p.total_cost_usd)
      : p.price_per_gallon_usd != null
        ? Number(p.gallons) * Number(p.price_per_gallon_usd)
        : 0;

  // Per vehicle: miles from trips, gallons + spend from receipts.
  const milesByVehicle = new Map<string, number>();
  for (const s of sessionRows ?? []) {
    if (!s.vehicle_id || !scope.vehicleIn(s.vehicle_id)) continue;
    milesByVehicle.set(s.vehicle_id, (milesByVehicle.get(s.vehicle_id) ?? 0) + Number(s.total_miles ?? 0));
  }
  const rows = vehicles
    .map((v) => {
      const vp = purchases.filter((p) => p.vehicle_id === v.id);
      const gallons = vp.reduce((a, p) => a + Number(p.gallons), 0);
      const spend = vp.reduce((a, p) => a + cost(p), 0);
      const miles = milesByVehicle.get(v.id) ?? 0;
      return {
        v,
        miles,
        gallons,
        spend,
        receipts: vp.length,
        mpg: gallons > 0 && miles > 0 ? miles / gallons : null,
        cpm: spend > 0 && miles > 0 ? spend / miles : null,
      };
    })
    .sort((a, b) => b.spend - a.spend || b.miles - a.miles);

  // Fleet totals over vehicles that have receipts (a car without receipts
  // would inflate the MPG with miles no fuel is recorded for).
  const fueled = rows.filter((r) => r.gallons > 0);
  const totalGallons = fueled.reduce((a, r) => a + r.gallons, 0);
  const totalSpend = fueled.reduce((a, r) => a + r.spend, 0);
  const fueledMiles = fueled.reduce((a, r) => a + r.miles, 0);

  // -- Idling ----------------------------------------------------------
  // Fuel per vehicle for the burn estimate: its latest receipt's fuel,
  // else its IFTA fuel if it's an IFTA truck, else gasoline (most fleet
  // cars and vans).
  const fuelByVehicle = new Map<string, "diesel" | "gasoline">();
  for (const v of vehicles) {
    const latest = purchases.find((p) => p.vehicle_id === v.id);
    fuelByVehicle.set(
      v.id,
      (latest?.fuel_type as "diesel" | "gasoline" | undefined) ?? (v.ifta_qualified ? v.ifta_fuel_type : "gasoline"),
    );
  }
  const priced = purchases.filter((p) => p.price_per_gallon_usd != null);
  const avgPrice =
    priced.length > 0
      ? priced.reduce((a, p) => a + Number(p.price_per_gallon_usd), 0) / priced.length
      : FALLBACK_PRICE_PER_GALLON;

  const idleEvents = ((idleRows ?? []) as IdleEvent[]).filter((e) => scope.vehicleIn(e.vehicle_id));
  const idleFleet = emptyTotals();
  const idleByVehicle = new Map<string, IdleTotals>();
  const idleByDriver = new Map<string, IdleTotals>();
  for (const e of idleEvents) {
    const fuel = (e.vehicle_id && fuelByVehicle.get(e.vehicle_id)) || "gasoline";
    addIdle(idleFleet, e, fuel, avgPrice);
    if (e.vehicle_id) {
      if (!idleByVehicle.has(e.vehicle_id)) idleByVehicle.set(e.vehicle_id, emptyTotals());
      addIdle(idleByVehicle.get(e.vehicle_id)!, e, fuel, avgPrice);
    }
    if (!idleByDriver.has(e.user_id)) idleByDriver.set(e.user_id, emptyTotals());
    addIdle(idleByDriver.get(e.user_id)!, e, fuel, avgPrice);
  }
  const tripMinByVehicle = new Map<string, number>();
  const tripMinByDriver = new Map<string, number>();
  for (const s of sessionRows ?? []) {
    if (!scope.vehicleIn(s.vehicle_id)) continue;
    const m = Number(s.total_duration_seconds ?? 0) / 60;
    if (s.vehicle_id) tripMinByVehicle.set(s.vehicle_id, (tripMinByVehicle.get(s.vehicle_id) ?? 0) + m);
    if (s.user_id) tripMinByDriver.set(s.user_id, (tripMinByDriver.get(s.user_id) ?? 0) + m);
  }
  const fleetTripMin = [...tripMinByVehicle.values()].reduce((a, m) => a + m, 0);
  const pct = (idle: number, trip: number) => (trip > 0 ? `${((idle / trip) * 100).toFixed(1)}%` : "—");

  const nameByUser = new Map(
    (memberRows ?? []).map((m) => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return [m.user_id as string, driverLabel(p, fleetIds.get(m.user_id as string))];
    }),
  );
  const driverRows = [...idleByDriver.entries()]
    .map(([uid, t]) => ({ uid, t, trip: tripMinByDriver.get(uid) ?? 0 }))
    .sort((a, b) => b.t.idleMinutes - a.t.idleMinutes);
  const longestIdle = idleEvents
    .filter((e) => e.kind === "idle")
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10);

  const anomalies = (anomalyRows ?? []).filter((a) => scope.vehicleIn(a.vehicle_id));
  const open = anomalies.filter((a) => a.status === "open");
  const reviewed = anomalies.filter((a) => a.status !== "open");
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  open.sort((a, b) => rank[a.severity] - rank[b.severity]);
  const alertsByPurchase = new Map<string, number>();
  for (const a of open) alertsByPurchase.set(a.purchase_id, (alertsByPurchase.get(a.purchase_id) ?? 0) + 1);

  function AlertCard({ a }: { a: (typeof anomalies)[number] }) {
    const p = purchaseById.get(a.purchase_id);
    const photo = p?.receipt_path ? photoByPath.get(p.receipt_path) : undefined;
    return (
      <li className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${SEVERITY_STYLE[a.severity]}`}>
            {a.severity}
          </span>
          <span className="font-semibold">{KIND_LABEL[a.kind] ?? a.kind}</span>
          <span className="text-sm text-muted">
            · {vehicleLabel(vehicleById.get(a.vehicle_id))}
            {p && ` · ${p.purchase_date} · ${Number(p.gallons).toFixed(1)} gal${p.state_code ? ` · ${p.state_code}` : ""}`}
          </span>
          {photo && (
            <a href={photo} target="_blank" rel="noreferrer" className="ml-auto text-xs font-semibold text-accent hover:underline">
              View receipt
            </a>
          )}
        </div>
        <p className="mt-1.5 text-sm text-foreground/90">{a.detail}</p>
        {a.status !== "open" && (
          <p className="mt-1.5 text-xs text-muted">
            {a.status === "confirmed" ? "Confirmed as a problem" : "Dismissed"}
            {a.reviewed_at && ` on ${new Date(a.reviewed_at).toLocaleDateString("en-US")}`}
            {a.review_note && ` — “${a.review_note}”`}
          </p>
        )}
        <AnomalyReview anomalyId={a.id} status={a.status as "open" | "dismissed" | "confirmed"} canEdit={canEdit} />
      </li>
    );
  }

  return (
    <main className="px-6 py-10 sm:px-10">
      <FuelAlertsLive orgId={orgId} />
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">Fuel</p>
          <h1 className="mt-1 text-2xl font-semibold">
            Consumption, idling &amp; alerts{scope.current && <span className="text-muted"> · {scope.current.name}</span>}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Every receipt a driver logs is checked against the vehicle&apos;s GPS trips and its usual
            consumption. Admins get a daily email when something new looks off.
          </p>
        </div>
        <PeriodPicker value={days} />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Fuel spend" value={money(totalSpend)} />
        <Stat label="Gallons" value={int(totalGallons)} />
        <Stat label="Fleet MPG" value={totalGallons > 0 && fueledMiles > 0 ? (fueledMiles / totalGallons).toFixed(1) : "—"} />
        <Stat label="Fuel cost / mile" value={totalSpend > 0 && fueledMiles > 0 ? money(totalSpend / fueledMiles) : "—"} />
        <Stat label="Open alerts" value={String(open.length)} danger={open.length > 0} />
        <Stat label="Idle time" value={formatMinutes(idleFleet.idleMinutes)} />
        <Stat label="Idle, % of trip time" value={pct(idleFleet.idleMinutes, fleetTripMin)} />
        <Stat label="Est. idle fuel" value={`${idleFleet.estGallons.toFixed(1)} gal`} />
        <Stat label="Est. idle cost" value={money(idleFleet.estCost)} />
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Alerts to review</h2>
        {open.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
            Nothing to review. New receipts are checked as soon as drivers log them.
          </p>
        ) : (
          <ul className="space-y-3">
            {open.map((a) => (
              <AlertCard key={a.id} a={a} />
            ))}
          </ul>
        )}
        {reviewed.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-muted">
              Reviewed ({reviewed.length})
            </summary>
            <ul className="mt-3 space-y-3">
              {reviewed.map((a) => (
                <AlertCard key={a.id} a={a} />
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold">Idling</h2>
        <p className="mb-3 max-w-3xl text-sm text-muted">
          Time stopped 3+ minutes while a trip was running (traffic, waiting, loading), read from the
          trip&apos;s GPS. Fuel and cost are estimates: about 0.4 gal/h for gasoline and 0.8 gal/h for
          diesel at idle (US DOE figures), at your fleet&apos;s average price of ${avgPrice.toFixed(2)}/gal
          {priced.length === 0 && " (no receipts with a price yet, so a typical price is used)"}. Stops of an
          hour or more count as parked, not idling.
        </p>
        {idleEvents.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
            No idling detected in this period.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-xs text-muted">
                    <th className="px-4 py-3 text-left font-medium">Driver</th>
                    <th className="px-4 py-3 font-medium">Idle</th>
                    <th className="px-4 py-3 font-medium">% of trips</th>
                    <th className="px-4 py-3 font-medium">Stops</th>
                    <th className="px-4 py-3 font-medium">Est. cost</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {driverRows.map((d) => (
                    <tr key={d.uid} className="border-b border-border text-right last:border-0">
                      <td className="px-4 py-2.5 text-left">{nameByUser.get(d.uid) ?? "Former member"}</td>
                      <td className="px-4 py-2.5 font-mono whitespace-nowrap">{formatMinutes(d.t.idleMinutes)}</td>
                      <td className="px-4 py-2.5 font-mono">{pct(d.t.idleMinutes, d.trip)}</td>
                      <td className="px-4 py-2.5 font-mono">{d.t.idleEvents}</td>
                      <td className="px-4 py-2.5 font-mono">{money(d.t.estCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl border border-border bg-surface">
              <p className="border-b border-border px-4 py-3 text-xs font-medium text-muted">Longest idles</p>
              <ul className="divide-y divide-border text-sm">
                {longestIdle.map((e) => (
                  <li key={`${e.session_id}-${e.started_at}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-20 shrink-0 font-mono font-semibold tabular-nums">{formatMinutes(e.minutes)}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">
                      {new Date(e.started_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      · {nameByUser.get(e.user_id) ?? "Driver"}
                      {e.vehicle_id && ` · ${vehicleById.get(e.vehicle_id)?.display_id ?? ""}`}
                    </span>
                    <a
                      href={`https://www.google.com/maps?q=${e.latitude},${e.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      Map
                    </a>
                  </li>
                ))}
              </ul>
              {idleFleet.longStops > 0 && (
                <p className="border-t border-border px-4 py-3 text-xs text-muted">
                  Also {idleFleet.longStops} long stop{idleFleet.longStops === 1 ? "" : "s"} (
                  {formatMinutes(idleFleet.longStopMinutes)}) with the trip still running, likely parked;
                  not counted as idling.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold">By vehicle</h2>
        <p className="mb-3 text-sm text-muted">
          Miles from GPS trips, fuel from receipts. Add a tank size to catch fill-ups bigger than the tank.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-xs text-muted">
                <th className="px-4 py-3 text-left font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Miles</th>
                <th className="px-4 py-3 font-medium">Receipts</th>
                <th className="px-4 py-3 font-medium">Gallons</th>
                <th className="px-4 py-3 font-medium">Spend</th>
                <th className="px-4 py-3 font-medium">MPG</th>
                <th className="px-4 py-3 font-medium">Cost / mile</th>
                <th className="px-4 py-3 font-medium">Idle</th>
                <th className="px-4 py-3 font-medium">Tank</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-muted">
                    No vehicles yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.v.id} className="border-b border-border text-right last:border-0">
                    <td className="px-4 py-2.5 text-left">{vehicleLabel(r.v)}</td>
                    <td className="px-4 py-2.5 font-mono">{int(r.miles)}</td>
                    <td className="px-4 py-2.5 font-mono">{r.receipts}</td>
                    <td className="px-4 py-2.5 font-mono">{r.gallons.toFixed(1)}</td>
                    <td className="px-4 py-2.5 font-mono">{money(r.spend)}</td>
                    <td className="px-4 py-2.5 font-mono">{r.mpg != null ? r.mpg.toFixed(1) : "—"}</td>
                    <td className="px-4 py-2.5 font-mono">{r.cpm != null ? money(r.cpm) : "—"}</td>
                    <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                      {idleByVehicle.get(r.v.id) ? (
                        <>
                          {formatMinutes(idleByVehicle.get(r.v.id)!.idleMinutes)}{" "}
                          <span className="text-xs text-muted">
                            ({pct(idleByVehicle.get(r.v.id)!.idleMinutes, tripMinByVehicle.get(r.v.id) ?? 0)})
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <TankCapacityInput
                        vehicleId={r.v.id}
                        value={r.v.fuel_tank_capacity_gal != null ? Number(r.v.fuel_tank_capacity_gal) : null}
                        canEdit={canEdit}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Receipts</h2>
        {purchases.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
            No fuel receipts in this period. Drivers log them in the app with a photo of the receipt.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Station</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 text-right font-medium">Gallons</th>
                  <th className="px-4 py-3 text-right font-medium">$/gal</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => {
                  const photo = p.receipt_path ? photoByPath.get(p.receipt_path) : undefined;
                  const flagged = alertsByPurchase.get(p.id) ?? 0;
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 whitespace-nowrap">{p.purchase_date}</td>
                      <td className="px-4 py-2.5">{vehicleLabel(vehicleById.get(p.vehicle_id))}</td>
                      <td className="px-4 py-2.5 text-muted">{p.vendor_name ?? "—"}</td>
                      <td className="px-4 py-2.5">{p.state_code ?? <span className="text-danger">Missing</span>}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{Number(p.gallons).toFixed(3)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {p.price_per_gallon_usd != null ? `$${Number(p.price_per_gallon_usd).toFixed(3)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{cost(p) > 0 ? money(cost(p)) : "—"}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {flagged > 0 && (
                          <span className="mr-3 rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-bold text-danger">
                            {flagged} alert{flagged === 1 ? "" : "s"}
                          </span>
                        )}
                        {photo && (
                          <a href={photo} target="_blank" rel="noreferrer" className="text-xs font-semibold text-accent hover:underline">
                            Receipt
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${danger ? "border-danger/40 bg-danger/10" : "border-border bg-surface"}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 font-mono text-xl font-bold tabular-nums ${danger ? "text-danger" : ""}`}>{value}</p>
    </div>
  );
}
