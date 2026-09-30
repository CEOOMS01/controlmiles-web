"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRealtimeAccessTokenAnyTier } from "../realtime-actions";
import { reviewFuelAnomaly, setTankCapacity } from "./actions";

const REALTIME_TOKEN_REFRESH_MS = 20 * 60_000;

/** Refreshes the page when an alert is created or reviewed anywhere --
 *  same token pattern as the geofence alerts feed (httpOnly cookies mean
 *  the browser client needs a server-issued Realtime token). */
export function FuelAlertsLive({ orgId }: { orgId: string }) {
  const router = useRouter();
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    const supabase = supabaseRef.current;
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    async function subscribe() {
      const token = await getRealtimeAccessTokenAnyTier();
      if (cancelled) return;
      if (token) supabase.realtime.setAuth(token);
      channel = supabase
        .channel(`fuel-anomalies-${orgId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "fuel_anomalies", filter: `organization_id=eq.${orgId}` },
          () => router.refresh(),
        )
        .subscribe();
      refreshTimer = setInterval(async () => {
        const next = await getRealtimeAccessTokenAnyTier();
        if (next) supabase.realtime.setAuth(next);
      }, REALTIME_TOKEN_REFRESH_MS);
    }
    subscribe();
    return () => {
      cancelled = true;
      if (refreshTimer) clearInterval(refreshTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [orgId, router]);

  return null;
}

export function PeriodPicker({ value }: { value: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Period"
      value={value}
      disabled={pending}
      onChange={(e) => startTransition(() => router.push(`/admin/fuel?days=${e.target.value}`))}
      className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-accent"
    >
      <option value={30}>Last 30 days</option>
      <option value={90}>Last 90 days</option>
      <option value={365}>Last 12 months</option>
    </select>
  );
}

export function AnomalyReview({
  anomalyId,
  status,
  canEdit,
}: {
  anomalyId: string;
  status: "open" | "dismissed" | "confirmed";
  canEdit: boolean;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canEdit) return null;

  function act(next: "open" | "dismissed" | "confirmed") {
    setError(null);
    startTransition(async () => {
      const res = await reviewFuelAnomaly(anomalyId, next, note);
      if (res.error) setError(res.error);
    });
  }

  if (status !== "open") {
    return (
      <button
        onClick={() => act("open")}
        disabled={pending}
        className="text-xs font-medium text-muted underline-offset-2 hover:text-accent hover:underline disabled:opacity-50"
      >
        Reopen
      </button>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        maxLength={300}
        className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
      />
      <button
        onClick={() => act("dismissed")}
        disabled={pending}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-background disabled:opacity-50"
      >
        Dismiss — explained
      </button>
      <button
        onClick={() => act("confirmed")}
        disabled={pending}
        className="rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        Confirm problem
      </button>
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </div>
  );
}

export function TankCapacityInput({
  vehicleId,
  value,
  canEdit,
}: {
  vehicleId: string;
  value: number | null;
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (!Number.isFinite(next) || next <= 0)) {
      setError("Enter gallons, e.g. 150");
      return;
    }
    if (next === value) return;
    setError(null);
    startTransition(async () => {
      const res = await setTankCapacity(vehicleId, next);
      if (res.error) setError(res.error);
    });
  }

  if (!canEdit) return <span className="text-muted">{value != null ? `${value} gal` : "—"}</span>;

  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          inputMode="decimal"
          placeholder="—"
          disabled={pending}
          aria-label="Tank capacity in gallons"
          className="w-16 rounded-md border border-border bg-background px-2 py-1 text-right text-sm outline-none focus:border-accent disabled:opacity-60"
        />
        <span className="text-xs text-muted">gal</span>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
