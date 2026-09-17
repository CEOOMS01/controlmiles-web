"use client";

import { useEffect, useState } from "react";
import { fetchStateMileage, type StateMileageRow } from "./actions";

type Vehicle = {
  id: string;
  nickname: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
};

function vehicleLabel(v: Vehicle) {
  const name = [v.year, v.make, v.model].filter(Boolean).join(" ");
  return v.nickname ? `${name} "${v.nickname}"` : name || v.id.slice(0, 6);
}

function currentQuarterRange(): { start: string; end: string } {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), quarter * 3, 1);
  const end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export function IftaReport({ orgId, vehicles }: { orgId: string; vehicles: Vehicle[] }) {
  const initialRange = currentQuarterRange();
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [results, setResults] = useState<StateMileageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const { rows, error } = await fetchStateMileage(orgId, startDate, endDate, vehicleId);
      if (cancelled) return;
      if (error) {
        setError(error);
        setResults([]);
      } else {
        setResults(rows);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [orgId, startDate, endDate, vehicleId]);

  const totalMiles = results.reduce((sum, r) => sum + r.miles, 0);
  const unattributed = results.find((r) => r.state_code === "UNKNOWN");
  const attributedRows = results.filter((r) => r.state_code !== "UNKNOWN");
  const unattributedPct = unattributed && totalMiles > 0 ? (unattributed.miles / totalMiles) * 100 : 0;

  // Real completeness fix, not a caveat left in place (explicit user
  // request, 2026-09-17): this report was view-only -- an admin actually
  // prepping an IFTA filing from these numbers had no way to get them out
  // of the browser except hand-copying each row. Client-side CSV is
  // enough here (compute_state_mileage already ran RLS-scoped in the
  // browser, no server secret involved), mirrors the escaping convention
  // already used by /api/admin/export/csv's toCsv().
  function downloadCsv() {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["State", "State Code", "Miles"].map(escape).join(",");
    const lines = attributedRows.map((r) =>
      [r.state_name, r.state_code, r.miles.toFixed(1)].map(escape).join(","),
    );
    if (unattributed) {
      lines.push(["Unattributed (no GPS match)", "UNKNOWN", unattributed.miles.toFixed(1)].map(escape).join(","));
    }
    lines.push(["TOTAL", "", totalMiles.toFixed(1)].map(escape).join(","));
    const csv = [header, ...lines].join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ifta-state-mileage-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-surface p-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium">From</label>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">To</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        {vehicles.length > 0 && (
          <div className="flex flex-1 flex-wrap gap-2">
            <button
              onClick={() => setVehicleId(null)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                vehicleId === null
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted hover:border-accent"
              }`}
            >
              All vehicles
            </button>
            {vehicles.map((v) => (
              <button
                key={v.id}
                onClick={() => setVehicleId(v.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  vehicleId === v.id
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border text-muted hover:border-accent"
                }`}
              >
                {vehicleLabel(v)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6 flex items-center justify-between rounded-xl bg-accent/10 px-6 py-5">
        <p className="text-sm font-medium text-muted">Total miles</p>
        <div className="flex items-center gap-4">
          <p className="font-mono text-2xl font-bold text-accent tabular-nums">
            {totalMiles.toFixed(1)} mi
          </p>
          <button
            onClick={downloadCsv}
            disabled={loading || results.length === 0}
            className="rounded-lg border border-accent/40 bg-background px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {!loading && unattributed && unattributedPct > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4">
          <span className="mt-0.5 text-amber-600 dark:text-amber-400">⚠</span>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {unattributedPct.toFixed(1)}% of miles in this range ({unattributed.miles.toFixed(1)} mi)
            couldn&apos;t be matched to a US state and are excluded from the breakdown below. Check GPS
            coverage for that period before using this for a filing.
          </p>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Loading…</p>
      ) : error ? (
        <p className="py-6 text-sm text-danger">Error: {error}</p>
      ) : results.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No mileage recorded for this range.</p>
      ) : attributedRows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          No mileage could be matched to a US state for this range.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 text-right font-medium">Miles</th>
              </tr>
            </thead>
            <tbody>
              {attributedRows.map((r) => (
                <tr key={r.state_code} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
                      {r.state_code}
                    </span>
                    {r.state_name}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{r.miles.toFixed(1)} mi</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-muted">
        Miles per state, computed from GPS breadcrumbs. This is not a fileable
        IFTA return — fuel gallons per jurisdiction are needed for the actual
        tax calculation and are not tracked in this app.
      </p>
    </div>
  );
}
