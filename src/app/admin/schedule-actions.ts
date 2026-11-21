"use server";

import { createClient } from "@/lib/supabase/server";

// Schedule bell (2026-11-16): every change to the class schedule by any role -- an instructor taking or
// releasing a class, time off, unavailable hours, a client booking, the office editing -- is logged in
// the database (schedule_events). The browser can't call these RPCs itself (its auth cookies are
// httpOnly, so it is `anon`), hence server actions. The database checks the caller is an
// owner/admin/operator of the org; nothing here widens that.

export type ScheduleEvent = {
  id: string;
  kind: string;
  created_at: string;
  actor_role: string | null;
  actor_name: string | null;
  instructor_name: string | null;
  is_new: boolean;
  /** The person who made the change is the instructor the change is about. */
  by_instructor: boolean;
  /** Traffic light: red = act now, amber = pay attention, green = information or already fixed. */
  severity: "red" | "amber" | "green";
  /** An alert about a situation that has been fixed since (the class started, got an instructor...). */
  resolved: boolean;
  payload: {
    date?: string;
    start?: string;
    end?: string;
    from?: string;
    to?: string;
    weekday?: number | null;
    hours_before?: number;
    has_student?: boolean;
    late_cancel?: boolean | null;
    label?: string | null;
    note?: string | null;
    late_minutes?: number;
    minutes_left?: number;
    minutes_after?: number;
  };
};

export type ScheduleEvents = { unread: number; events: ScheduleEvent[] };

export async function getScheduleEvents(orgId: string): Promise<ScheduleEvents> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_schedule_events", { p_org: orgId, p_limit: 40 });
  if (error || !data) return { unread: 0, events: [] };
  const d = data as { unread: number; events: ScheduleEvent[] | null };
  return { unread: Number(d.unread) || 0, events: d.events ?? [] };
}

/** Hides events from this person's panel only (the log is untouched). No ids = everything they can see. */
export async function dismissScheduleEvents(orgId: string, ids?: string[]): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("dismiss_schedule_events", { p_org: orgId, p_ids: ids && ids.length > 0 ? ids : null });
}

export async function markScheduleEventsRead(orgId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_schedule_events_read", { p_org: orgId });
}
