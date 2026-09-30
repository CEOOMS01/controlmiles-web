"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FUEL_LABEL, type IftaFuel, type IftaPurchase, type IftaReturn, type IftaVehicle } from "@/lib/ifta";
import { correctFuelPurchase, setVehicleIfta } from "./actions";

// The 48 IFTA member states (AK, HI and DC aren't in the agreement) --
// same list as the app's fuel receipt screen.
const IFTA_STATES = [
  "AL", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "ID", "IL", "IN", "IA", "KS", "KY", "LA",
  "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND",
  "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const selectClass =
  "rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent disabled:opacity-60";

export function QuarterPicker({ quarters, value }: { quarters: string[]; value: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Quarter"
      value={value}
      disabled={pending}
      onChange={(e) => startTransition(() => router.push(`/admin/ifta?q=${e.target.value}`))}
      className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-accent"
    >
      {quarters.map((q, i) => (
        <option key={q} value={q}>
          {q.replace("-", " ")}
          {i === 0 ? " (current)" : ""}
        </option>
      ))}
    </select>
  );
}

export function VehicleIftaRow({ vehicle, canEdit }: { vehicle: IftaVehicle; canEdit: boolean }) {
  const [qualified, setQualified] = useState(vehicle.ifta_qualified);
  const [fuel, setFuel] = useState<IftaFuel>(vehicle.ifta_fuel_type);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(nextQualified: boolean, nextFuel: IftaFuel) {
    const prev = { qualified, fuel };
    setQualified(nextQualified);
    setFuel(nextFuel);
    setError(null);
    startTransition(async () => {
      const res = await setVehicleIfta(vehicle.id, nextQualified, nextFuel);
      if (res.error) {
        setQualified(prev.qualified);
        setFuel(prev.fuel);
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
      <label className="flex flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={qualified}
          disabled={!canEdit || pending}
          onChange={(e) => save(e.target.checked, fuel)}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        <span>{vehicle.label}</span>
      </label>
      <select
        aria-label="Fuel type"
        value={fuel}
        disabled={!canEdit || pending}
        onChange={(e) => save(qualified, e.target.value as IftaFuel)}
        className={selectClass}
      >
        <option value="diesel">Diesel</option>
        <option value="gasoline">Gasoline</option>
      </select>
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </div>
  );
}

export function PurchaseIftaRow({
  purchase,
  vehicleLabel,
  canEdit,
}: {
  purchase: IftaPurchase;
  vehicleLabel: string;
  canEdit: boolean;
}) {
  const [state, setState] = useState(purchase.state_code ?? "");
  const [fuel, setFuel] = useState<IftaFuel>(purchase.fuel_type);
  const [taxPaid, setTaxPaid] = useState(purchase.tax_paid);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: { state: string; fuel: IftaFuel; taxPaid: boolean }) {
    const prev = { state, fuel, taxPaid };
    setState(next.state);
    setFuel(next.fuel);
    setTaxPaid(next.taxPaid);
    setError(null);
    startTransition(async () => {
      const res = await correctFuelPurchase(purchase.id, next.state || null, next.fuel, next.taxPaid);
      if (res.error) {
        setState(prev.state);
        setFuel(prev.fuel);
        setTaxPaid(prev.taxPaid);
        setError(res.error);
      }
    });
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-2.5 whitespace-nowrap">{purchase.purchase_date}</td>
      <td className="px-4 py-2.5">{vehicleLabel}</td>
      <td className="px-4 py-2.5 text-muted">{purchase.vendor_name ?? "—"}</td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{Number(purchase.gallons).toFixed(3)}</td>
      <td className="px-4 py-2.5">
        <select
          aria-label="State"
          value={state}
          disabled={!canEdit || pending}
          onChange={(e) => save({ state: e.target.value, fuel, taxPaid })}
          className={`${selectClass} ${state ? "" : "border-danger text-danger"}`}
        >
          <option value="">Missing</option>
          {IFTA_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </td>
      <td className="px-4 py-2.5">
        <select
          aria-label="Fuel type"
          value={fuel}
          disabled={!canEdit || pending}
          onChange={(e) => save({ state, fuel: e.target.value as IftaFuel, taxPaid })}
          className={selectClass}
        >
          <option value="diesel">Diesel</option>
          <option value="gasoline">Gasoline</option>
        </select>
      </td>
      <td className="px-4 py-2.5">
        <input
          type="checkbox"
          aria-label="State fuel tax paid at the pump"
          checked={taxPaid}
          disabled={!canEdit || pending}
          onChange={(e) => save({ state, fuel, taxPaid: e.target.checked })}
          className="h-4 w-4"
        />
      </td>
    </tr>
  );
}

/** Jurisdiction summary per fuel type + per-vehicle totals, one CSV --
 *  the figures a base jurisdiction's return asks for, line by line. */
export function ExportIftaCsv({ ret, labels }: { ret: IftaReturn; labels: Record<string, string> }) {
  function download() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const row = (cells: (string | number)[]) => cells.map(esc).join(",");
    const lines: string[] = [row([`IFTA return ${ret.quarter}`])];
    for (const s of ret.sections) {
      lines.push("");
      lines.push(row([`${FUEL_LABEL[s.fuel]}`, `Total miles ${s.totalMiles}`, `Total gallons ${s.totalGallons}`, `MPG ${s.mpg?.toFixed(2) ?? "n/a"}`]));
      lines.push(row(["Jurisdiction", "Total miles", "Taxable miles", "Taxable gallons", "Tax-paid gallons", "Net taxable gallons", "Tax rate", "Tax due (credit)", "Surcharge rate", "Surcharge due"]));
      for (const l of s.lines) {
        lines.push(
          row([
            l.state,
            l.totalMiles,
            l.taxableMiles,
            l.taxableGallons,
            l.taxPaidGallons,
            l.netTaxableGallons,
            l.rate ?? "",
            l.rate != null ? l.tax.toFixed(2) : "",
            l.surchargeRate ?? "",
            l.surchargeRate != null ? l.surcharge.toFixed(2) : "",
          ]),
        );
      }
      lines.push(row(["TOTAL", s.totalMiles, "", "", "", "", "", s.totalTax.toFixed(2), "", s.totalSurcharge.toFixed(2)]));
    }
    lines.push("");
    lines.push(row(["Vehicle", "Fuel", "Miles", "Unattributed miles", "Gallons", "MPG"]));
    for (const v of ret.vehicles) {
      lines.push(
        row([
          labels[v.vehicle.id] ?? v.vehicle.id,
          FUEL_LABEL[v.vehicle.ifta_fuel_type],
          Math.round(v.miles),
          Math.round(v.unattributedMiles),
          v.gallons.toFixed(3),
          v.mpg?.toFixed(2) ?? "",
        ]),
      );
    }
    lines.push("");
    lines.push(row(["NET TAX DUE (CREDIT)", ret.netDue.toFixed(2)]));

    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ifta-return-${ret.quarter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      disabled={ret.sections.length === 0}
      className="rounded-lg border border-accent/40 bg-background px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Export CSV
    </button>
  );
}
