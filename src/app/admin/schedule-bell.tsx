"use client";

// Schedule bell + live schedule (2026-11-16). Mounted once in the admin shell for schools with classes:
//  * the bell lists every schedule change by any role (new ones marked) and updates the moment one happens;
//  * while the admin is looking at the class schedule (/admin/shifts), the page refreshes itself on any
//    change to classes, time off or unavailable hours, so the schedule is always the updated one.
// Same Realtime token pattern as fuel-controls.tsx: httpOnly cookies mean the browser client needs a
// server-issued token; the real boundary is each table's RLS.

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRealtimeAccessTokenAnyTier } from "./realtime-actions";
import { getScheduleEvents, markScheduleEventsRead, type ScheduleEvent } from "./schedule-actions";

const TOKEN_REFRESH_MS = 20 * 60_000;
const WATCHED = ["shift_blocks", "ds_time_off", "ds_blocked_hours", "schedule_events"] as const;

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

export function ScheduleBell({ orgId }: { orgId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const supabaseRef = useRef(createClient());
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const openRef = useRef(false);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const reload = useCallback(async () => {
    const r = await getScheduleEvents(orgId);
    setEvents(r.events);
    // Looking at the list = reading it: a change that arrives while the list is open is marked read
    // right away (it keeps its dot until the list is closed), so the red badge never comes back.
    if (openRef.current && r.unread > 0) {
      setUnread(0);
      await markScheduleEventsRead(orgId);
    } else {
      setUnread(r.unread);
    }
  }, [orgId]);

  async function markAllRead() {
    setUnread(0);
    setEvents((prev) => prev.map((e) => ({ ...e, is_new: false })));
    await markScheduleEventsRead(orgId);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    let cancelled = false;
    let tokenTimer: ReturnType<typeof setInterval> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    function onChange() {
      // Debounced: one instructor action can touch several rows.
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void reload();
        if (pathRef.current.startsWith("/admin/shifts")) router.refresh();
      }, 500);
    }

    async function subscribe() {
      const token = await getRealtimeAccessTokenAnyTier();
      if (cancelled) return;
      if (token) supabase.realtime.setAuth(token);
      let ch = supabase.channel(`schedule-live-${orgId}-${Math.random().toString(36).slice(2, 8)}`);
      for (const table of WATCHED) {
        ch = ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `organization_id=eq.${orgId}` }, onChange);
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
  }, [orgId, reload, router]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await markScheduleEventsRead(orgId);
      setUnread(0); // the list keeps its "new" marks until it is closed
    }
    if (!next) void reload();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Schedule changes, ${unread} new` : "Schedule changes"}
        aria-expanded={open}
        className="relative rounded-md p-1.5 text-sidebar-muted hover:text-sidebar-strong"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
          <path
            d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9ZM10 19a2 2 0 0 0 4 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Schedule changes"
          className="fixed left-3 right-3 top-14 z-50 max-h-[80vh] overflow-hidden rounded-xl sm:right-auto sm:w-96 border border-border bg-surface p-2 text-foreground shadow-xl"
        >
          <div className="flex items-center justify-between px-2 pb-1 pt-1">
            <p className="text-sm font-semibold">Schedule changes</p>
            {events.some((e) => e.is_new) && (
              <button type="button" onClick={markAllRead} className="text-xs font-medium text-accent hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          {events.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">No changes yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {events.map((e) => (
                <li key={e.id} className="flex gap-2 px-2 py-2.5 text-sm">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.is_new ? "bg-accent" : "bg-transparent"}`} />
                  <span className="min-w-0">
                    <span className="block">{describe(e)}</span>
                    <span className="block text-xs text-muted">{ago(e.created_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
