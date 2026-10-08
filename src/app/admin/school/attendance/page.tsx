// School attendance report (2026-10-09, user rule + 4 adjustments): the
// day's colors -- blue/Present, gray/Released (a red alert resolved with a
// reason; counts as attendance), yellow/Absent, red/Unresolved -- plus the
// red alerts and how each was resolved. Filter by dates and route; download
// the CSV or print it as a PDF for the county school district.

import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { ATTENDANCE_COLOR, attendanceTotals, loadAttendance } from "@/lib/school-attendance";
import { STATUS_PILL } from "@/lib/school-status";
import { fleetNow } from "@/lib/school";
import { loadReportBranding } from "@/lib/report-branding";
import { PrintButton } from "./print-button";
import { BrandingForm } from "../branding-form";
import { inputClass } from "../form-kit";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; route?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!user || !orgId) return null;

  const { data: org } = await supabase.from("organizations").select("name, timezone").eq("id", orgId).maybeSingle();
  const tz = org?.timezone ?? "America/New_York";
  const today = fleetNow(tz).date;
  const to = sp.to && DATE.test(sp.to) ? sp.to : today;
  const from = sp.from && DATE.test(sp.from) ? sp.from : shiftDate(to, -6);
  const routeId = sp.route || null;

  const [{ data: routes }, rows, branding] = await Promise.all([
    supabase
      .from("routes")
      .select("id, name")
      .eq("organization_id", orgId)
      .in("route_type", ["school_am", "school_pm"])
      .order("name"),
    loadAttendance(supabase, orgId, from, to, routeId),
    loadReportBranding(supabase, orgId),
  ]);

  const totals = attendanceTotals(rows);
  const alerts = rows.filter((r) => r.status === "Released" || r.status === "Unresolved");
  const time = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }) : "—";
  const exportHref = `/admin/school/attendance/export?from=${from}&to=${to}${routeId ? `&route=${routeId}` : ""}`;

  return (
    <main className="space-y-6 px-6 py-10 sm:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          {branding.logoUrl && (
            // Signed URL from private storage; next/image would need the host allow-listed.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={`${branding.name} logo`} className="h-16 w-auto max-w-[180px] object-contain" />
          )}
          <div>
            <p className="text-lg font-semibold">{branding.name}</p>
            <h1 className="text-2xl font-semibold">Student transportation attendance</h1>
            <p className="mt-1 text-sm text-muted">
              {from} to {to}. A pick-up counts as attendance, and so does a release to a parent or the school
              with a reason. Days a route didn&apos;t run aren&apos;t counted.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <BrandingForm defaultName={org?.name ?? ""} customName={branding.customName} hasLogo={Boolean(branding.logoUrl)} />
          <a
            href={exportHref}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
          >
            Download CSV
          </a>
          <PrintButton />
        </div>
      </div>

      <form className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-4 print:hidden">
        <div>
          <label className="mb-1.5 block text-sm font-medium">From</label>
          <input type="date" name="from" defaultValue={from} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">To</label>
          <input type="date" name="to" defaultValue={to} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Route</label>
          <select name="route" defaultValue={routeId ?? ""} className={inputClass}>
            <option value="">All school routes</option>
            {(routes ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-accent">
            Show
          </button>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Present</p>
          <p className="text-2xl font-semibold text-blue-600">{totals.present}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Released (with reason)</p>
          <p className="text-2xl font-semibold text-slate-500">{totals.released}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Absent</p>
          <p className="text-2xl font-semibold text-amber-600">{totals.absent}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Attendance rate</p>
          <p className="text-2xl font-semibold">{totals.rate == null ? "—" : `${totals.rate}%`}</p>
          {totals.unresolved > 0 && <p className="mt-1 text-xs font-semibold text-red-600">{totals.unresolved} unresolved</p>}
        </div>
      </div>

      {alerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Alerts and how they were resolved</h2>
          <p className="text-sm text-muted">
            Students who rode to school in the morning but didn&apos;t take the afternoon bus.
          </p>
          <ul className="space-y-1.5">
            {alerts.map((r, i) => (
              <li
                key={`alert-${r.date}-${r.route}-${r.student}-${i}`}
                className={`rounded-lg border px-3 py-2 text-sm ${STATUS_PILL[ATTENDANCE_COLOR[r.status]]}`}
              >
                <span className="font-semibold">{r.student}</span> · {r.date} · {r.route} --{" "}
                {r.status === "Released" ? `released: ${r.note}` : "unresolved, being checked at the school"}
                {r.pickedUpAt && r.status === "Released" ? ` (${time(r.pickedUpAt)})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Grade</th>
              <th className="px-4 py-3 font-medium">School</th>
              <th className="px-4 py-3 font-medium">Route</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Stop</th>
              <th className="px-4 py-3 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.date}-${r.route}-${r.student}-${i}`}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-2.5">{r.date}</td>
                <td className="px-4 py-2.5 font-medium">
                  {r.student}
                  {r.studentExternalId && <span className="ml-2 text-xs text-muted">#{r.studentExternalId}</span>}
                </td>
                <td className="px-4 py-2.5 text-muted">{r.grade ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted">{r.school ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted">
                  {r.route} · {r.run}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_PILL[ATTENDANCE_COLOR[r.status]]}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted">{time(r.pickedUpAt)}</td>
                <td className="px-4 py-2.5 text-muted">{r.stop ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs text-muted">{r.note ?? ""}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted">
                  No school routes ran in these dates.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
