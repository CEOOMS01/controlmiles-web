"use client";

// Route efficiency (2026-09-09, explicit user request for a chart
// "example: route efficiency"). Real limitation, disclosed rather than
// papered over: `routes` stores origin/destination as free text (no
// geocoded lat/lon -- even after the new address autocomplete, selecting
// a suggestion only fills the text field, coordinates aren't persisted),
// and `sessions` has no route_id at all, so "planned distance vs. actual
// GPS miles driven" genuinely cannot be computed from what exists today
// -- faking it would mean inventing numbers. What IS real and already
// stored: every route's lifecycle timestamps (created_at -> closed_at)
// and status. This chart shows exactly that: how many routes are in each
// stage right now, and how long closed routes actually took to complete
// -- a legitimate, honest efficiency signal (faster average cycle time
// = a fleet executing routes more efficiently) rather than a fabricated
// distance-delta metric.

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type RouteStatusCount = { status: string; count: number };

export function RouteEfficiencyChart({
  statusCounts,
  avgCycleHours,
}: {
  statusCounts: RouteStatusCount[];
  avgCycleHours: number | null;
}) {
  const total = statusCounts.reduce((s, r) => s + r.count, 0);

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="font-semibold">Route efficiency</p>
          <p className="text-sm text-muted">Route stages and average time to complete.</p>
        </div>
        {avgCycleHours != null && (
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums">
              {avgCycleHours < 24
                ? `${avgCycleHours.toFixed(1)}h`
                : `${(avgCycleHours / 24).toFixed(1)}d`}
            </p>
            <p className="text-xs text-muted">avg. cycle time</p>
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
          No routes created yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={statusCounts} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="status" width={64} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
