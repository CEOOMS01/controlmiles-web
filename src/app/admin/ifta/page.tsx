import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import {
  computeIftaReturn,
  FUEL_LABEL,
  quarterDueDate,
  quarterOf,
  quarterRange,
  recentQuarters,
  type IftaFuel,
  type IftaPurchase,
  type IftaRate,
  type IftaVehicle,
  type VehicleStateMiles,
} from "@/lib/ifta";
import { ExportIftaCsv, PurchaseIftaRow, QuarterPicker, VehicleIftaRow } from "./ifta-controls";

// Full IFTA quarterly return (2026-09-30, explicit user request). Was a
// miles-per-state view only; now the whole return the way Samsara/Motive
// lay it out: pick the quarter, pick the IFTA vehicles, and get fleet MPG,
// taxable gallons, tax-paid credits, tax + surcharge per state, with the
// problems an auditor would catch listed first. Math in src/lib/ifta.ts.

function vehicleLabel(v: {
  id: string;
  nickname: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  display_id: string | null;
  plate: string | null;
}) {
  const name = [v.year, v.make, v.model].filter(Boolean).join(" ");
  const label = v.nickname ? `${name} "${v.nickname}"`.trim() : name || v.plate;
  const id = v.display_id ?? v.id.slice(0, 6);
  return label ? `${label} (${id})` : id;
}

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const int = (n: number) => Math.round(n).toLocaleString("en-US");

export default async function IftaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const quarters = recentQuarters(new Date(), 8);
  const requested = (await searchParams).q;
  // Default to the next return to file: last quarter while its due date
  // hasn't passed (Oct 1-31 -> Q3), otherwise the current quarter.
  const today = new Date().toISOString().slice(0, 10);
  const nextToFile = today <= quarterDueDate(quarters[1]) ? quarters[1] : quarters[0];
  const quarter =
    typeof requested === "string" && quarters.includes(requested) ? requested : nextToFile;
  const { start, end } = quarterRange(quarter);
  const isCurrent = quarter === quarterOf(new Date());

  const [{ data: vehicleRows }, { data: milesRows, error: milesError }, { data: purchaseRows }, { data: rateRows }, { data: me }] =
    await Promise.all([
      supabase
        .from("vehicles")
        .select("id, display_id, nickname, make, model, year, plate, ifta_qualified, ifta_fuel_type")
        .eq("organization_id", orgId)
        .eq("is_archived", false)
        .order("created_at", { ascending: true }),
      supabase.rpc("compute_ifta_vehicle_state_miles", {
        p_organization_id: orgId,
        p_start_date: start,
        p_end_date: end,
      }),
      supabase
        .from("fuel_purchases")
        .select("id, vehicle_id, purchase_date, state_code, gallons, fuel_type, tax_paid, vendor_name, total_cost_usd")
        .eq("organization_id", orgId)
        .gte("purchase_date", start)
        .lte("purchase_date", end)
        .order("purchase_date", { ascending: true }),
      supabase
        .from("ifta_fuel_tax_rates")
        .select("jurisdiction_code, fuel_type, kind, rate_usd")
        .eq("quarter", quarter)
        .in("fuel_type", ["special_diesel", "gasoline"]),
      supabase
        .from("organization_members")
        .select("member_role")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const canEdit = me?.member_role === "owner" || me?.member_role === "admin";
  const vehicles: IftaVehicle[] = (vehicleRows ?? []).map((v) => ({
    id: v.id,
    label: vehicleLabel(v),
    ifta_qualified: v.ifta_qualified,
    ifta_fuel_type: v.ifta_fuel_type as IftaFuel,
  }));
  const labelById = new Map(vehicles.map((v) => [v.id, v.label]));
  const purchases = (purchaseRows ?? []) as IftaPurchase[];

  const ret = computeIftaReturn({
    quarter,
    vehicles,
    miles: (milesRows ?? []) as VehicleStateMiles[],
    purchases,
    rates: (rateRows ?? []) as IftaRate[],
  });

  const qualifiedCount = vehicles.filter((v) => v.ifta_qualified).length;
  const qualifiedIds = new Set(vehicles.filter((v) => v.ifta_qualified).map((v) => v.id));
  const quarterPurchases = purchases.filter((p) => qualifiedIds.has(p.vehicle_id));
  const totalMiles = ret.sections.reduce((s, x) => s + x.totalMiles, 0);
  const totalGallons = ret.sections.reduce((s, x) => s + x.totalGallons, 0);
  const due = quarterDueDate(quarter);

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">IFTA</p>
          <h1 className="mt-1 text-2xl font-semibold">Quarterly fuel tax return</h1>
          <p className="mt-2 text-sm text-muted">
            {quarter.replace("-", " ")} · {start} to {end} · due{" "}
            {new Date(`${due}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            {isCurrent && " · quarter still in progress"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <QuarterPicker quarters={quarters} value={quarter} />
          <ExportIftaCsv ret={ret} labels={Object.fromEntries(labelById)} />
        </div>
      </div>

      {milesError && (
        <p className="mb-6 text-sm text-danger">GPS miles couldn&apos;t be loaded. Try again in a moment.</p>
      )}

      {qualifiedCount === 0 ? (
        <section className="mb-8 rounded-xl border border-accent/40 bg-accent/5 p-6">
          <h2 className="text-lg font-semibold">Choose your IFTA vehicles</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            IFTA covers qualified motor vehicles: two axles and over 26,000 lb, or three or more axles,
            used across state lines. Mark them below with the fuel they use. Cars and light vans stay
            out of the return.
          </p>
          <VehicleTable vehicles={vehicles} canEdit={canEdit} />
        </section>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-4">
            <Stat label="Total miles" value={int(totalMiles)} />
            <Stat label="Total gallons" value={int(totalGallons)} />
            <Stat
              label="Fleet MPG"
              value={ret.sections.map((s) => (s.mpg != null ? s.mpg.toFixed(2) : "—")).join(" / ") || "—"}
              hint={ret.sections.length > 1 ? ret.sections.map((s) => FUEL_LABEL[s.fuel]).join(" / ") : undefined}
            />
            <Stat
              label={ret.netDue < 0 ? "Net credit" : "Net tax due"}
              value={ret.ratesAvailable ? money(Math.abs(ret.netDue)) : "Pending rates"}
              accent
            />
          </div>

          {ret.issues.length > 0 && (
            <section className="mb-8 rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
              <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Needs attention before filing
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {ret.issues.map((i) => (
                  <li key={i.text} className="flex gap-2">
                    <span className={i.severity === "error" ? "text-danger" : "text-amber-600 dark:text-amber-400"}>
                      {i.severity === "error" ? "●" : "▲"}
                    </span>
                    <span className="text-foreground/90">{i.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ret.sections.map((s) => (
            <section key={s.fuel} className="mb-8">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{FUEL_LABEL[s.fuel]} — jurisdiction summary</h2>
                <p className="text-sm text-muted">
                  {int(s.totalMiles)} mi ÷ {int(s.totalGallons)} gal ={" "}
                  <span className="font-semibold text-foreground">{s.mpg != null ? `${s.mpg.toFixed(2)} MPG` : "MPG n/a"}</span>
                </p>
              </div>
              {s.lines.length === 0 ? (
                <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
                  No miles or fuel recorded for {FUEL_LABEL[s.fuel].toLowerCase()} vehicles this quarter.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-right text-xs text-muted">
                        <th className="px-3 py-3 text-left font-medium">State</th>
                        <th className="px-3 py-3 font-medium">Total mi</th>
                        <th className="px-3 py-3 font-medium">Taxable mi</th>
                        <th className="px-3 py-3 font-medium">Taxable gal</th>
                        <th className="px-3 py-3 font-medium">Tax-paid gal</th>
                        <th className="px-3 py-3 font-medium">Net taxable gal</th>
                        <th className="px-3 py-3 font-medium">Rate</th>
                        <th className="px-3 py-3 font-medium">Tax / (credit)</th>
                        <th className="px-3 py-3 font-medium">Surcharge</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono tabular-nums">
                      {s.lines.map((l) => (
                        <tr key={l.state} className="border-b border-border text-right last:border-0">
                          <td className="px-3 py-2.5 text-left font-sans">
                            <span className="font-semibold">{l.state}</span>
                            {!l.iftaMember && <span className="ml-2 text-xs text-muted">non-IFTA</span>}
                          </td>
                          <td className="px-3 py-2.5">{int(l.totalMiles)}</td>
                          <td className="px-3 py-2.5">{int(l.taxableMiles)}</td>
                          <td className="px-3 py-2.5">{int(l.taxableGallons)}</td>
                          <td className="px-3 py-2.5">{int(l.taxPaidGallons)}</td>
                          <td className="px-3 py-2.5">{int(l.netTaxableGallons)}</td>
                          <td className="px-3 py-2.5 text-muted">{l.rate != null ? l.rate.toFixed(4) : "—"}</td>
                          <td className={`px-3 py-2.5 ${l.tax < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                            {l.rate != null ? (l.tax < 0 ? `(${money(-l.tax)})` : money(l.tax)) : "—"}
                          </td>
                          <td className="px-3 py-2.5">{l.surchargeRate != null ? money(l.surcharge) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="font-mono tabular-nums">
                      <tr className="border-t border-border bg-background/50 text-right font-semibold">
                        <td className="px-3 py-3 text-left font-sans">Total</td>
                        <td className="px-3 py-3">{int(s.totalMiles)}</td>
                        <td className="px-3 py-3">{int(s.lines.reduce((a, l) => a + l.taxableMiles, 0))}</td>
                        <td className="px-3 py-3">{int(s.lines.reduce((a, l) => a + l.taxableGallons, 0))}</td>
                        <td className="px-3 py-3">{int(s.lines.reduce((a, l) => a + l.taxPaidGallons, 0))}</td>
                        <td className="px-3 py-3">{int(s.lines.reduce((a, l) => a + l.netTaxableGallons, 0))}</td>
                        <td className="px-3 py-3" />
                        <td className="px-3 py-3">{money(s.totalTax)}</td>
                        <td className="px-3 py-3">{money(s.totalSurcharge)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          ))}

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">By vehicle</h2>
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-xs text-muted">
                    <th className="px-4 py-3 text-left font-medium">Vehicle</th>
                    <th className="px-4 py-3 text-left font-medium">Fuel</th>
                    <th className="px-4 py-3 font-medium">Miles</th>
                    <th className="px-4 py-3 font-medium">Gallons</th>
                    <th className="px-4 py-3 font-medium">MPG</th>
                  </tr>
                </thead>
                <tbody>
                  {ret.vehicles.map((v) => (
                    <tr key={v.vehicle.id} className="border-b border-border text-right last:border-0">
                      <td className="px-4 py-2.5 text-left">{v.vehicle.label}</td>
                      <td className="px-4 py-2.5 text-left text-muted">{FUEL_LABEL[v.vehicle.ifta_fuel_type]}</td>
                      <td className="px-4 py-2.5 font-mono tabular-nums">{int(v.miles)}</td>
                      <td className="px-4 py-2.5 font-mono tabular-nums">{v.gallons.toFixed(1)}</td>
                      <td className="px-4 py-2.5 font-mono tabular-nums">{v.mpg != null ? v.mpg.toFixed(2) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-1 text-lg font-semibold">Fuel receipts</h2>
            <p className="mb-3 text-sm text-muted">
              Logged by drivers in the app with a photo of the receipt. Only gallons with the state&apos;s
              tax paid at the pump earn a credit.
            </p>
            {quarterPurchases.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
                No fuel receipts for IFTA vehicles this quarter.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Vehicle</th>
                      <th className="px-4 py-3 font-medium">Vendor</th>
                      <th className="px-4 py-3 text-right font-medium">Gallons</th>
                      <th className="px-4 py-3 font-medium">State</th>
                      <th className="px-4 py-3 font-medium">Fuel</th>
                      <th className="px-4 py-3 font-medium">Tax paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quarterPurchases.map((p) => (
                      <PurchaseIftaRow
                        key={p.id}
                        purchase={p}
                        vehicleLabel={labelById.get(p.vehicle_id) ?? "—"}
                        canEdit={canEdit}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <details className="mb-8 rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer text-sm font-semibold">
              IFTA vehicles ({qualifiedCount} of {vehicles.length})
            </summary>
            <VehicleTable vehicles={vehicles} canEdit={canEdit} />
          </details>
        </>
      )}

      <p className="text-xs text-muted">
        Miles come from each trip&apos;s GPS track, attributed to the state it was driven in. Rates are
        IFTA, Inc.&apos;s published matrix for the quarter. Fleet MPG, taxable gallons and whole-number
        rounding follow the IFTA return instructions. Enter these figures on your base jurisdiction&apos;s
        return and keep the trip records and receipts for 4 years.
      </p>
    </main>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${accent ? "border-accent/30 bg-accent/10" : "border-border bg-surface"}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 font-mono text-xl font-bold tabular-nums ${accent ? "text-accent" : ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function VehicleTable({ vehicles, canEdit }: { vehicles: IftaVehicle[]; canEdit: boolean }) {
  if (vehicles.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted">
        No vehicles yet. <Link href="/admin/roster" className="text-accent underline">Add them in Team</Link>.
      </p>
    );
  }
  return (
    <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-background">
      {vehicles.map((v) => (
        <VehicleIftaRow key={v.id} vehicle={v} canEdit={canEdit} />
      ))}
    </div>
  );
}
