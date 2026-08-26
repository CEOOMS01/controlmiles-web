"use client";

import { useState } from "react";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function ExportPage() {
  const [startDate, setStartDate] = useState(firstOfMonthIso());
  const [endDate, setEndDate] = useState(todayIso());

  const query = `start_date=${startDate}&end_date=${endDate}`;

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          Export
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Fleet-wide mileage</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          One export covering every driver in this range — a rollup, not
          each driver&apos;s full trip-by-trip detail (that&apos;s still
          available per-driver through the Report Portal).
        </p>
      </div>

      <div className="max-w-xl rounded-xl border border-border bg-surface p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">From</label>
            <input
              type="date"
              value={startDate}
              max={todayIso()}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">To</label>
            <input
              type="date"
              value={endDate}
              max={todayIso()}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={`/api/admin/export/csv?${query}`}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
          >
            Download CSV
          </a>
          <a
            href={`/api/admin/export/pdf?${query}`}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-accent"
          >
            Download PDF
          </a>
        </div>
      </div>
    </main>
  );
}
