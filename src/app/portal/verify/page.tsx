"use client";

import { useState } from "react";
import { gigAppLabel, irsPurposeLabel } from "@/lib/catalog";
import type { PortalReport } from "./report-data";

type RedeemResponse = {
  success: boolean;
  message: string;
  report: PortalReport | null;
};

export default function VerifyPage() {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PortalReport | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/portal/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.get("code"),
          website: form.get("website"), // honeypot
        }),
      });
      const data: RedeemResponse = await res.json();

      if (!data.success || !data.report) {
        setError(data.message || "Invalid or expired code.");
        return;
      }
      setReport(data.report);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (report) {
    return <ReportView report={report} onReset={() => setReport(null)} />;
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">
            ControlMiles Report Portal
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Enter access code</h1>
          <p className="mt-2 text-sm text-muted">
            Enter the code your client shared with you to view their
            mileage report. No account needed.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6">
          {/* Honeypot -- left empty by real users, hidden via CSS not
              `type=hidden` so simple bots that skip hidden inputs still
              fill it. */}
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <label htmlFor="website">Leave this field empty</label>
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <div>
            <label htmlFor="code" className="mb-1.5 block text-sm font-medium">
              Access code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              maxLength={8}
              autoComplete="off"
              autoCapitalize="characters"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXXXXX"
              className="w-full rounded-lg border border-border bg-background px-3.5 py-3 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || code.length < 4}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Verifying…" : "View report"}
          </button>
        </form>
      </div>
    </main>
  );
}

// "January 2026" when the period sits in one month, "January 2026 –
// December 2026" when it spans more than one -- the mobile app has no
// existing "collapse a date range into a month-year label" helper to
// reuse (its DateFormat('MMMM yyyy') calls only ever label a single
// month's session group), so this is new, purpose-built for the portal.
function formatPeriod(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const opts: Intl.DateTimeFormatOptions = { month: "long", year: "numeric", timeZone: "UTC" };
  const startLabel = start.toLocaleDateString("en-US", opts);
  const endLabel = end.toLocaleDateString("en-US", opts);
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
}

function formatWeekRange(startDate: string, endDate: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const start = new Date(`${startDate}T00:00:00Z`).toLocaleDateString("en-US", opts);
  const end = new Date(`${endDate}T00:00:00Z`).toLocaleDateString("en-US", opts);
  return `${start} – ${end}`;
}

function ReportView({ report, onReset }: { report: PortalReport; onReset: () => void }) {
  return (
    <main className="flex flex-1 justify-center px-4 py-16">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-accent uppercase">
              ControlMiles Report Portal
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              {report.driver_display_name || "Driver"}
            </h1>
            {report.driver_display_id && (
              <p className="text-sm text-muted">ID: {report.driver_display_id}</p>
            )}
          </div>
          <p className="shrink-0 pt-1 text-right text-xs text-muted">
            Generated
            <br />
            {new Date(report.generated_at).toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="grid grid-cols-2 gap-4 border-b border-border pb-4 sm:grid-cols-3">
            <Stat label="Period" value={formatPeriod(report.start_date, report.end_date)} />
            <Stat label="Total miles" value={report.total_miles.toFixed(1)} />
            <Stat label="Sessions" value={String(report.total_sessions)} />
          </div>

          <div className="border-b border-border py-4">
            <p className="text-xs text-muted">Estimated deduction (IRS standard mileage rate)</p>
            <p className="mt-0.5 text-xl font-semibold text-[#15803d]">
              ${report.total_deduction_estimate.toFixed(2)}
            </p>
          </div>

          {report.vehicles.length > 0 && (
            <div className="border-b border-border py-4">
              <h2 className="mb-2 text-sm font-semibold">Vehicles used</h2>
              <ul className="space-y-1 text-sm text-muted">
                {report.vehicles.map((v, i) => (
                  <li key={i}>
                    {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                    {v.nickname ? ` — "${v.nickname}"` : ""}
                    {v.plate ? ` · Plate ${v.plate}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.weekly_checkpoints.length > 0 && (
            <div className="border-b border-border py-4">
              <h2 className="mb-2 text-sm font-semibold">Weekly odometer photos</h2>
              <div className="space-y-3">
                {report.weekly_checkpoints.map((cp, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <p className="mb-2 text-xs font-medium text-muted">
                      Week of {formatWeekRange(cp.week_start_date, cp.week_end_date)}
                      {cp.vehicle
                        ? ` · ${[cp.vehicle.year, cp.vehicle.make, cp.vehicle.model].filter(Boolean).join(" ")}${cp.vehicle.nickname ? ` "${cp.vehicle.nickname}"` : ""}`
                        : ""}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <OdometerTile
                        label="Start"
                        value={cp.start_odometer_value}
                        photoUrl={cp.start_odometer_photo_url}
                      />
                      <OdometerTile
                        label="End"
                        value={cp.end_odometer_value}
                        photoUrl={cp.end_odometer_photo_url}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.gig_app_breakdown.length > 0 && (
            <div className="pt-4">
              <h2 className="mb-2 text-sm font-semibold">Trip purpose breakdown</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="pb-1.5 font-medium">App</th>
                    <th className="pb-1.5 font-medium">Purpose</th>
                    <th className="pb-1.5 text-right font-medium">Miles</th>
                  </tr>
                </thead>
                <tbody>
                  {report.gig_app_breakdown.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-1.5">{gigAppLabel(row.gig_app)}</td>
                      <td className="py-1.5 text-muted">
                        {irsPurposeLabel(row.irs_purpose) ?? "—"}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{row.miles.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-muted">
          Estimated using the IRS 2026 standard mileage rates ($0.725/mile Jan 1 – Jun 30,
          $0.76/mile Jul 1 – Dec 31 — each trip priced at the rate in effect on its own date).
          ControlMiles is not affiliated with or endorsed by the IRS or any official agency.
          This is an informational estimate only, not a guaranteed deduction — consult a tax
          professional.
        </p>

        <button
          onClick={onReset}
          className="mt-6 text-sm text-accent hover:underline"
        >
          Enter a different code
        </button>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function OdometerTile({
  label,
  value,
  photoUrl,
}: {
  label: string;
  value: number | null;
  photoUrl: string | null;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{label}</p>
      {photoUrl ? (
        <a href={photoUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={photoUrl}
            alt={`${label} odometer photo`}
            className="h-24 w-full rounded-md border border-border object-cover"
          />
        </a>
      ) : (
        <div className="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted">
          No photo
        </div>
      )}
      <p className="mt-1 text-sm font-medium">
        {value != null ? `${value.toLocaleString()} mi` : "—"}
      </p>
    </div>
  );
}
