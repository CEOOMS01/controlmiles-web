"use client";

// "Needs attention" card of the school dashboard (2026-11-20). It replaces the bell in the top bar:
//  * the school's live notifications (schedule_events) appear here the moment they happen, with a traffic
//    light (red = act now, amber = pay attention, green = information or already fixed). Each person can
//    dismiss one, or clear them all, from their own panel only;
//  * above them, the items the page works out itself (failed inspections, money owed, students running low...).
// Same Realtime token pattern as fuel-controls.tsx: httpOnly cookies mean the browser client needs a
// server-issued token; the real boundary is each table's RLS.
// <ScheduleLiveRefresh> (mounted once in the admin shell) keeps the class schedule page current while an admin
// looks at it, as the bell used to.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRealtimeAccessTokenAnyTier } from "./realtime-actions";
import { dismissScheduleEvents, getScheduleEvents, markScheduleEventsRead, type ScheduleEvent } from "./schedule-actions";

const TOKEN_REFRESH_MS = 20 * 60_000;
const WATCHED = ["shift_blocks", "ds_time_off", "ds_blocked_hours", "schedule_events"] as const;

const LIGHT: Record<ScheduleEvent["severity"], { dot: string; label: string }> = {
  red: { dot: "bg-danger", label: "Needs action now" },
  amber: { dot: "bg-warning", label: "Pay attention" },
  green: { dot: "bg-success", label: "Information" },
};

export type AttentionItem = { tone: "danger" | "warning" | "info"; title: string; detail: string; href: string };

function clock(hms?: string) {
  if (!hms) return "";
  const [h, m] = hms.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function day(iso?: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function who(e: ScheduleEvent) {
  if (e.actor_role === "client") return "A client";
  if (e.actor_role === "system") return "The system";
  return e.actor_name ?? "Someone";
}

/** One sentence per event, in plain English. */
export function describe(e: ScheduleEvent): string {
  const p = e.payload ?? {};
  const slot = `${day(p.date)} ${clock(p.start)}–${clock(p.end)}`;
  const instr = e.instructor_name ?? "an instructor";
  switch (e.kind) {
    case "class_claimed":
      return e.by_instructor || !e.instructor_name
        ? `${who(e)} took the class on ${slot}.`
        : `${who(e)} assigned ${instr} to the class on ${slot}.`;
    case "class_released": {
      const short = typeof p.hours_before === "number" && p.hours_before < 24;
      const left = `${short ? ` (only ${Math.max(0, Math.round(p.hours_before!))} h before)` : ""}. It is open now.`;
      return e.by_instructor || !e.instructor_name
        ? `${who(e)} released the class on ${slot}${left}`
        : `${who(e)} took ${instr} off the class on ${slot}${left}`;
    }
    case "class_reassigned":
      return `${who(e)} moved the class on ${slot} to ${instr}.`;
    case "class_created":
      return `${who(e)} added a class on ${slot}${e.instructor_name ? ` for ${instr}` : " with no instructor"}.`;
    case "class_booked_portal":
      return `A client booked ${slot}${e.instructor_name ? ` with ${instr}` : ""}.`;
    case "class_changed":
      return `${who(e)} changed the class on ${slot}.`;
    case "class_cancelled":
      return `${who(e)} cancelled the class on ${slot}.`;
    case "class_deleted":
      return `${who(e)} deleted the class on ${slot}.`;
    case "class_late_start":
      return `${instr} started the class on ${slot} ${p.late_minutes ?? "?"} min late.`;
    case "class_unclaimed_soon": {
      const left = typeof p.minutes_left === "number" ? p.minutes_left : null;
      return `No instructor yet for the class on ${slot}${left === null ? "" : left <= 0 ? " — it should be starting now" : ` — starts in ${left} min`}.`;
    }
    case "class_no_show":
      return `${instr} has not started the class on ${slot} — ${p.minutes_after ?? "?"} min past its start time.`;
    case "time_off_added":
      return `${instr} is off ${p.from === p.to ? day(p.from) : `${day(p.from)} – ${day(p.to)}`}${p.note ? ` (${p.note})` : ""}${e.actor_role && e.actor_role !== "driver" ? ` — set by ${who(e)}` : ""}.`;
    case "time_off_removed":
      return `${instr}'s days off ${p.from === p.to ? day(p.from) : `${day(p.from)} – ${day(p.to)}`} were removed.`;
    case "unavailable_added":
      return `${e.instructor_name ? instr : "School"} unavailable ${p.date ? day(p.date) : `every ${WEEKDAYS[p.weekday ?? 0]}`} ${clock(p.start)}–${clock(p.end)}${p.label ? ` (${p.label})` : ""}.`;
    case "unavailable_removed":
      return `${e.instructor_name ? instr : "School"} unavailable hours ${p.date ? day(p.date) : `every ${WEEKDAYS[p.weekday ?? 0]}`} ${clock(p.start)}–${clock(p.end)} were removed.`;
    default:
      return "The schedule changed.";
  }
}

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Realtime feed of the tables that change the schedule; calls [onChange] (debounced) on any change. */
function useScheduleRealtime(orgId: string, enabled: boolean, onChange: () => void) {
  const supabaseRef = useRef(createClient());
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) return;
    const supabase = supabaseRef.current;
    let cancelled = false;
    let tokenTimer: ReturnType<typeof setInterval> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    function fire() {
      // Debounced: one instructor action can touch several rows.
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => onChangeRef.current(), 500);
    }

    async function subscribe() {
      const token = await getRealtimeAccessTokenAnyTier();
      if (cancelled) return;
      if (token) supabase.realtime.setAuth(token);
      let ch = supabase.channel(`schedule-live-${orgId}-${Math.random().toString(36).slice(2, 8)}`);
      for (const table of WATCHED) {
        ch = ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `organization_id=eq.${orgId}` }, fire);
      }
      channel = ch.subscribe();
      tokenTimer = setInterval(async () => {
        const next = await getRealtimeAccessTokenAnyTier();
        if (next) supabase.realtime.setAuth(next);
      }, TOKEN_REFRESH_MS);
    }
    void subscribe();
    return () => {
      cancelled = true;
      if (tokenTimer) clearInterval(tokenTimer);
      if (debounce) clearTimeout(debounce);
      if (channel) supabase.removeChannel(channel);
    };
  }, [orgId, enabled]);
}

/** Mounted once in the admin shell: while the class schedule page is open it refreshes itself on any change. */
export function ScheduleLiveRefresh({ orgId }: { orgId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const onChange = useCallback(() => router.refresh(), [router]);
  useScheduleRealtime(orgId, pathname.startsWith("/admin/shifts"), onChange);
  return null;
}

export function NeedsAttentionPanel({ orgId, items }: { orgId: string; items: AttentionItem[] }) {
  const router = useRouter();
  const [events, setEvents] = useState<ScheduleEvent[] | null>(null);

  const reload = useCallback(async () => {
    const r = await getScheduleEvents(orgId);
    setEvents(r.events);
    // The panel is on screen: what it shows counts as read (the ring on new rows stays until the next reload).
    if (r.unread > 0) await markScheduleEventsRead(orgId);
  }, [orgId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  // A change also moves the numbers the page works out itself (cars, students, money): refresh those too.
  const onChange = useCallback(() => {
    void reload();
    router.refresh();
  }, [reload, router]);
  useScheduleRealtime(orgId, true, onChange);

  // The page's own items (money owed, students low on hours...) are worked out on every load, so there is no row
  // to hide. A dismissal is remembered in this browser by the item's text: it comes back only if the situation
  // changes (e.g. "4 students" becomes "5 students").
  const storeKey = `cm-attention-dismissed:${orgId}`;
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(JSON.parse(localStorage.getItem(storeKey) ?? "[]"));
    } catch {}
  }, [storeKey]);
  function hideItems(titles: string[]) {
    const next = [...new Set([...hidden, ...titles])].slice(-50);
    setHidden(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {}
  }
  const shownItems = items.filter((a) => !hidden.includes(a.title));

  async function dismiss(ids?: string[]) {
    // Optimistic: the rows leave the panel at once; the server hides them for this person only.
    setEvents((prev) => (prev ? (ids ? prev.filter((e) => !ids.includes(e.id)) : []) : prev));
    await dismissScheduleEvents(orgId, ids);
    void reload();
  }

  const list = events ?? [];
  const reds = list.filter((e) => e.severity === "red").length;
  const ambers = list.filter((e) => e.severity === "amber").length;
  const nothing = events !== null && list.length === 0 && shownItems.length === 0;

  return (
    <section className="rounded-xl border border-border bg-surface p-5 lg:col-span-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Needs attention</p>
        <span className="flex items-center gap-3 text-xs text-muted">
          {reds > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-danger" /> {reds} need action
            </span>
          )}
          {ambers > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-warning" /> {ambers} to watch
            </span>
          )}
          <span className="flex items-center gap-1" title="Updates the moment something happens">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
          </span>
          {(list.length > 0 || shownItems.length > 0) && (
            <button
              type="button"
              onClick={() => {
                hideItems(shownItems.map((a) => a.title));
                if (list.length > 0) void dismiss();
              }}
              className="font-medium text-muted hover:text-foreground hover:underline">
              Clear all
            </button>
          )}
        </span>
      </div>

      {nothing ? (
        <div className="py-8 text-center">
          <p className="text-sm font-medium text-success">All clear</p>
          <p className="mt-1 text-xs text-muted">Nothing waiting on you right now.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {shownItems.map((a) => (
            <li key={a.title} className="flex gap-3 rounded-lg border border-border p-3 text-sm transition hover:border-accent">
              <span
                aria-hidden="true"
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  a.tone === "danger" ? "bg-danger" : a.tone === "warning" ? "bg-warning" : "bg-accent"
                }`}
              />
              <Link href={a.href} className="min-w-0 flex-1">
                <span className="block font-medium">{a.title}</span>
                <span className="block truncate text-xs text-muted">{a.detail}</span>
              </Link>
              <button
                type="button"
                onClick={() => hideItems([a.title])}
                aria-label="Dismiss this notification"
                className="-mr-1 h-6 w-6 shrink-0 rounded text-muted hover:bg-border hover:text-foreground"
              >
                ×
              </button>
            </li>
          ))}
          {list.map((e) => (
            <li key={e.id} className="flex gap-3 rounded-lg border border-border p-3 text-sm">
              <span
                title={LIGHT[e.severity]?.label}
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LIGHT[e.severity]?.dot ?? "bg-success"} ${e.is_new ? "ring-2 ring-accent/40" : ""}`}
              />
              <span className="min-w-0 flex-1">
                <span className={`block ${e.severity === "red" ? "font-medium" : ""}`}>{describe(e)}</span>
                <span className="block text-xs text-muted">
                  {ago(e.created_at)}
                  {e.resolved ? " · ✓ Resolved" : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void dismiss([e.id])}
                aria-label="Dismiss this notification"
                className="-mr-1 h-6 w-6 shrink-0 rounded text-muted hover:bg-border hover:text-foreground"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
