"use server";

// Olympus Mont Systems LLC - ControlMiles
// src/app/admin/shifts/agenda-actions.ts
//
// Driving school agenda (2026-10-26): load a week of classes for the big
// calendar, add / move / cancel a class from it, and the school's blocked hours
// (lunch). The conflict rules live in the database (fn_ds_conflict, used by
// ds_office_add_block and ds_office_move_block), so the calendar, the Add class
// form and the client's booking all follow the same rules.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { conflictMessage } from "@/lib/ds-conflicts";

export type AgendaBlock = {
  id: string;
  /** null = an open class: no instructor yet. */
  driver_id: string | null;
  vehicle_id: string | null;
  student_id: string | null;
  block_date: string;
  start_time: string;
  end_time: string;
  status: "scheduled" | "in_progress" | "done" | "cancelled";
  source: "template" | "one_off";
  note: string | null;
  booked_via: string | null;
};
export type AgendaAvailability = { id: string; instructor_id: string; weekday: number; start_time: string; end_time: string };
export type AgendaBlocked = {
  id: string;
  instructor_id: string | null;
  weekday: number | null;
  on_date: string | null;
  start_time: string;
  end_time: string;
  label: string | null;
};
export type AgendaTimeOff = { instructor_id: string; date_from: string; date_to: string };
export type AgendaWeek = {
  blocks: AgendaBlock[];
  availability: AgendaAvailability[];
  blocked: AgendaBlocked[];
  timeOff: AgendaTimeOff[];
  /** The school's lesson hours (HH:MM:SS), null = no limit. */
  hours: { open: string | null; close: string | null };
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function getAgendaWeek(orgId: string, from: string, days: number): Promise<AgendaWeek | { error: string }> {
  if (!DATE.test(from)) return { error: "Bad date." };
  const supabase = await createClient();
  const to = new Date(`${from}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + Math.max(1, Math.min(days, 14)) - 1);
  const toKey = to.toISOString().slice(0, 10);
  const [blocks, availability, blocked, timeOff, settings] = await Promise.all([
    supabase.rpc("get_org_shift_range", { p_org: orgId, p_from: from, p_days: days }),
    supabase.from("ds_availability").select("id, instructor_id, weekday, start_time, end_time").eq("organization_id", orgId),
    supabase
      .from("ds_blocked_hours")
      .select("id, instructor_id, weekday, on_date, start_time, end_time, label")
      .eq("organization_id", orgId),
    supabase
      .from("ds_time_off")
      .select("instructor_id, date_from, date_to")
      .eq("organization_id", orgId)
      .lte("date_from", toKey)
      .gte("date_to", from),
    supabase.from("ds_settings").select("booking_open_time, booking_close_time").eq("organization_id", orgId).maybeSingle(),
  ]);
  if (blocks.error) return { error: AppError.from(blocks.error).display() };
  return {
    blocks: (blocks.data ?? []) as AgendaBlock[],
    availability: (availability.data ?? []) as AgendaAvailability[],
    blocked: (blocked.data ?? []) as AgendaBlocked[],
    timeOff: (timeOff.data ?? []) as AgendaTimeOff[],
    hours: { open: settings.data?.booking_open_time ?? null, close: settings.data?.booking_close_time ?? null },
  };
}

export async function addAgendaClass(input: {
  orgId: string;
  /** null = an open class (no instructor yet; any instructor of the location can take it). */
  driverId: string | null;
  vehicleId: string | null;
  date: string;
  start: string; // HH:MM
  end: string;
  studentId: string | null;
  note?: string | null;
}): Promise<{ error: string | null }> {
  if (!DATE.test(input.date)) return { error: "Pick a date." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("ds_office_add_block", {
    p_org: input.orgId,
    p_driver: input.driverId,
    p_vehicle: input.vehicleId,
    p_date: input.date,
    p_start: input.start,
    p_end: input.end,
    p_student: input.studentId,
    p_note: input.note?.trim() || null,
  });
  if (error) return { error: conflictMessage(error.message) };
  revalidatePath("/admin/shifts");
  return { error: null };
}

export async function moveAgendaClass(input: {
  blockId: string;
  date: string;
  start: string;
  driverId: string | null;
  vehicleId: string | null;
}): Promise<{ error: string | null }> {
  if (!DATE.test(input.date)) return { error: "Pick a date." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("ds_office_move_block", {
    p_block: input.blockId,
    p_date: input.date,
    p_start: input.start,
    p_driver: input.driverId,
    p_vehicle: input.vehicleId,
  });
  if (error) return { error: conflictMessage(error.message) };
  revalidatePath("/admin/shifts");
  return { error: null };
}

export async function cancelAgendaClass(blockId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shift_blocks")
    .update({ status: "cancelled" })
    .eq("id", blockId)
    .eq("status", "scheduled")
    .select("id");
  if (error) return { error: AppError.from(error).display() };
  if (!data || data.length === 0) return { error: "Only a scheduled class can be cancelled." };
  revalidatePath("/admin/shifts");
  return { error: null };
}

// ── Reset the calendar (2026-11-20) ─────────────────────────────────────────

export type ResetInput = {
  orgId: string;
  /** The school's today (YYYY-MM-DD): only what is from today on is touched, history stays. */
  today: string;
  daysOff: boolean;
  blockedHours: boolean;
  availability: boolean;
  /** Classes still scheduled from today on (never started, never done). */
  classes: boolean;
};
export type ResetResult = { error: string | null; removed: { daysOff: number; blockedHours: number; availability: number; classes: number } };

/**
 * Cleans the calendar back to blank, piece by piece. The database decides what the caller may delete (policies:
 * admins and operators only, their own location, and a class only while it is still "scheduled"); nothing here
 * widens that. Days off that already ended and classes already taught are history and are left alone.
 */
export async function resetCalendar(input: ResetInput): Promise<ResetResult> {
  const removed = { daysOff: 0, blockedHours: 0, availability: 0, classes: 0 };
  if (!DATE.test(input.today)) return { error: "Bad date.", removed };
  const supabase = await createClient();
  try {
    if (input.daysOff) {
      const { data, error } = await supabase
        .from("ds_time_off")
        .delete()
        .eq("organization_id", input.orgId)
        .gte("date_to", input.today)
        .select("id");
      if (error) throw error;
      removed.daysOff = data?.length ?? 0;
    }
    if (input.blockedHours) {
      // One-off blocks of past dates are history; weekly / daily ones (no date) and future dates go.
      const { data, error } = await supabase
        .from("ds_blocked_hours")
        .delete()
        .eq("organization_id", input.orgId)
        .or(`on_date.is.null,on_date.gte.${input.today}`)
        .select("id");
      if (error) throw error;
      removed.blockedHours = data?.length ?? 0;
    }
    if (input.availability) {
      const { data, error } = await supabase.from("ds_availability").delete().eq("organization_id", input.orgId).select("id");
      if (error) throw error;
      removed.availability = data?.length ?? 0;
    }
    if (input.classes) {
      const { data, error } = await supabase
        .from("shift_blocks")
        .delete()
        .eq("organization_id", input.orgId)
        .eq("status", "scheduled")
        .gte("block_date", input.today)
        .select("id");
      if (error) throw error;
      removed.classes = data?.length ?? 0;
    }
  } catch (e) {
    revalidatePath("/admin/shifts");
    return { error: AppError.from(e as { message: string }).display(), removed };
  }
  revalidatePath("/admin/shifts");
  revalidatePath("/admin");
  return { error: null, removed };
}

// ── Blocked hours (lunch, breaks) ───────────────────────────────────────────

export async function addBlockedHours(input: {
  orgId: string;
  instructorId: string | null; // null = whole school
  /** Weekdays 0-6; empty with no date = every day. */
  weekdays: number[];
  onDate: string | null;
  start: string;
  end: string;
  label: string;
}): Promise<{ error: string | null }> {
  if (!input.start || !input.end) return { error: "Enter a start and end time." };
  if (input.end <= input.start) return { error: "The block must end after it starts." };
  if (input.onDate && !DATE.test(input.onDate)) return { error: "Pick a valid date." };
  const supabase = await createClient();
  const base = {
    organization_id: input.orgId,
    instructor_id: input.instructorId,
    start_time: input.start,
    end_time: input.end,
    label: input.label.trim().slice(0, 60) || null,
  };
  const rows: (typeof base & { weekday: number | null; on_date: string | null })[] = input.onDate
    ? [{ ...base, on_date: input.onDate, weekday: null }]
    : input.weekdays.length > 0
      ? input.weekdays.map((w) => ({ ...base, weekday: w, on_date: null }))
      : [{ ...base, weekday: null, on_date: null }];
  const { error } = await supabase.from("ds_blocked_hours").insert(rows);
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin/shifts");
  return { error: null };
}

export async function updateBlockedHours(input: {
  id: string;
  start: string;
  end: string;
  label: string;
}): Promise<{ error: string | null }> {
  if (!input.start || !input.end) return { error: "Enter a start and end time." };
  if (input.end <= input.start) return { error: "The block must end after it starts." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ds_blocked_hours")
    .update({ start_time: input.start, end_time: input.end, label: input.label.trim().slice(0, 60) || null })
    .eq("id", input.id)
    .select("id");
  if (error) return { error: AppError.from(error).display() };
  if (!data?.length) return { error: "Could not change it. Check your permissions." };
  revalidatePath("/admin/shifts");
  return { error: null };
}

// ── Instructor availability (the "Closed" shading is everything outside it) ──

export async function updateAvailability(input: { id: string; start: string; end: string }): Promise<{ error: string | null }> {
  if (!input.start || !input.end) return { error: "Enter a start and end time." };
  if (input.end <= input.start) return { error: "The window must end after it starts." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ds_availability")
    .update({ start_time: input.start, end_time: input.end })
    .eq("id", input.id)
    .select("id");
  if (error) return { error: AppError.from(error).display() };
  if (!data?.length) return { error: "Could not change it. Check your permissions." };
  revalidatePath("/admin/shifts");
  return { error: null };
}

export async function updateTimeOff(input: { id: string; from: string; to: string; note: string }): Promise<{ error: string | null }> {
  if (!DATE.test(input.from) || !DATE.test(input.to)) return { error: "Pick the dates." };
  if (input.to < input.from) return { error: "The last day can't be before the first." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ds_time_off")
    .update({ date_from: input.from, date_to: input.to, note: input.note.trim().slice(0, 120) || null })
    .eq("id", input.id)
    .select("id");
  if (error) return { error: AppError.from(error).display() };
  if (!data?.length) return { error: "Could not change it. Check your permissions." };
  revalidatePath("/admin/shifts");
  return { error: null };
}

export async function deleteAvailability(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ds_availability").delete().eq("id", id).select("id");
  if (error) return { error: AppError.from(error).display() };
  if (!data?.length) return { error: "Could not remove it. Check your permissions." };
  revalidatePath("/admin/shifts");
  return { error: null };
}

export async function deleteBlockedHours(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("ds_blocked_hours").delete().eq("id", id);
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin/shifts");
  return { error: null };
}
