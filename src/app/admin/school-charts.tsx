"use client";

// Driving school dashboard charts (2026-10-20): lessons per week and each
// instructor's booked hours this week. Same recharts style as the fleet
// dashboard's charts.

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type WeekPoint = { week: string; done: number; upcoming: number; cancelled: number };
export type InstructorLoad = { name: string; booked: number; open: number | null };

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

export function LessonsPerWeekChart({ data }: { data: WeekPoint[] }) {
  const total = data.reduce((s, d) => s + d.done, 0);
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Lessons per week</p>
          <p className="text-sm text-muted">Last 8 weeks and this week, by week starting Monday.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums">{total}</p>
          <p className="text-xs text-muted">lessons taught</p>
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="week" interval={0} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border)", opacity: 0.3 }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="done" name="Taught" stackId="a" fill="var(--success)" />
            <Bar dataKey="upcoming" name="Booked" stackId="a" fill="var(--accent)" />
            <Bar dataKey="cancelled" name="Cancelled" stackId="a" fill="var(--danger)" fillOpacity={0.6} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function InstructorLoadChart({ data }: { data: InstructorLoad[] }) {
  const withOpen = data.some((d) => d.open != null);
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3">
        <p className="font-semibold">Instructor load this week</p>
        <p className="text-sm text-muted">
          {withOpen ? "Hours booked against each instructor's availability." : "Hours of lessons booked per instructor."}
        </p>
      </div>
      {data.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">No lessons booked this week.</p>
      ) : (
        <div style={{ height: Math.max(160, data.length * 40 + 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit=" h" />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border)", opacity: 0.3 }} formatter={(v) => `${v} h`} />
              {withOpen && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
              <Bar dataKey="booked" name="Booked" stackId="a" fill="var(--accent)" />
              {withOpen && (
                <Bar dataKey="open" name="Still open" stackId="a" fill="var(--accent)" fillOpacity={0.2} radius={[0, 4, 4, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
