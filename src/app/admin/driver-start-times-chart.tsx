"use client";

// Driver session-start punctuality (2026-09-09, explicit user request:
// "tardanzas de driver para iniciar sesion"). Real limitation, disclosed
// rather than faked: there is no per-driver scheduled shift-start time
// anywhere in this schema (routes only have a scheduled_date, no time of
// day, and aren't linked to sessions at all) -- so "how many minutes
// late was this driver" cannot be computed against a real expected time,
// and inventing a fake 8am-for-everyone baseline would misrepresent real
// drivers. What's shown instead: each driver's own actual first-session
// start time per day over the last 14 days, plotted so a manager can see
// who is consistent vs. drifting later -- a real, honest signal (their
// own historical pattern is the baseline, not a fabricated schedule).

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export type DriverStartPoint = { date: string; hour: number };
export type DriverStartSeries = { driverId: string; driverName: string; points: DriverStartPoint[] };

const LINE_COLORS = ["#2c6c99", "#bd5b26", "#5b8c5a", "#9b59b6", "#c0392b", "#16a085"];

function hourLabel(hour: number): string {
  // Normalize first -- the Y axis' own top tick is exactly 24 (midnight
  // of the next day), which without this wraps to "12:00 PM" instead of
  // "12:00 AM" (h % 12 === 0 with h=24 still passes h < 12 as false).
  const normalized = ((hour % 24) + 24) % 24;
  const h = Math.floor(normalized);
  const m = Math.round((normalized - h) * 60);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function DriverStartTimesChart({ series }: { series: DriverStartSeries[] }) {
  const hasData = series.some((s) => s.points.length > 0);

  // Recharts wants one array of rows keyed by date, each driver as its
  // own field, not one array per driver.
  const dateSet = new Set<string>();
  series.forEach((s) => s.points.forEach((p) => dateSet.add(p.date)));
  const dates = Array.from(dateSet).sort();

  const rows = dates.map((date) => {
    const row: Record<string, string | number> = { date };
    series.forEach((s) => {
      const point = s.points.find((p) => p.date === date);
      if (point) row[s.driverName] = point.hour;
    });
    return row;
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="font-semibold">Session start times</p>
      <p className="text-sm text-muted">
        Each driver&apos;s first trip start time, last 14 days.
      </p>

      {!hasData ? (
        <div className="mt-3 flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
          No trip activity in the last 14 days.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240} className="mt-3">
          <LineChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(d: string) => d.slice(5)}
            />
            <YAxis
              domain={[0, 24]}
              ticks={[0, 6, 12, 18, 24]}
              tickFormatter={(h: number) => hourLabel(h)}
              tick={{ fontSize: 11 }}
              width={64}
            />
            <Tooltip
              formatter={(value) => hourLabel(Number(value))}
              labelFormatter={(label) => label}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((s, i) => (
              <Line
                key={s.driverId}
                type="monotone"
                dataKey={s.driverName}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                connectNulls
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
