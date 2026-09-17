"use client";

// Olympus Mont Systems LLC - ControlMiles
// src/app/admin/roster/generate-report-button.tsx
//
// Admin-for-any-driver half of the Report Portal (explicit user request,
// 2026-09-18: real fix for the pricing page's "Report Portal for any
// driver" Starter-tier claim, which had no working admin path until
// today). Per-row local state, same pattern as RemoveButton -- each
// driver's button opens/generates independently, not a single shared
// form.

import { useState, useTransition } from "react";
import { generateReportForDriver } from "./actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfYearIso() {
  return `${new Date().getFullYear()}-01-01`;
}

export function GenerateReportButton({
  driverUserId,
  driverName,
}: {
  driverUserId: string;
  driverName: string;
}) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(firstOfYearIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await generateReportForDriver(driverUserId, startDate, endDate);
      setError(res.error);
      setResult(res.result);
    });
  }

  if (result) {
    return (
      <div className="flex flex-col items-end gap-1 text-right">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-[var(--code-bg)] px-3 py-1.5 font-mono text-sm tracking-[0.2em] text-[var(--code-foreground)]">
            {result.code}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(result.code);
              setCopied(true);
            }}
            className="text-xs text-accent hover:underline"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          onClick={() => {
            setResult(null);
            setOpen(false);
          }}
          className="text-xs text-muted hover:underline"
        >
          Done
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-accent transition hover:underline"
      >
        Generate report
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          aria-label={`Report start date for ${driverName}`}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
        />
        <span className="text-xs text-muted">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          aria-label={`Report end date for ${driverName}`}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
        />
        <button
          onClick={handleGenerate}
          disabled={pending}
          className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "…" : "Generate"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
