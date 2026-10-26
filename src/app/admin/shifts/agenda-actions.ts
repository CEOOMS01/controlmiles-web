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
  driver_id: string;
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
export type AgendaAvailability = { instructor_id: string; weekday: number; start_time: string; end_time: string };
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
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function getAgendaWeek(orgId: string, from: string, days: number): Promise<AgendaWeek | { error: string }> {
  if (!DATE.test(from)) return { error: "Bad date." };
  const supabase = await createClient();
  const to = new Date(`${from}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + Math.max(1, Math.min(days, 14)) - 1);
  const toKey = to.toISOString().slice(0, 10);
  const [blocks, availability, blocked, timeOff] = await Promise.all([
    supabase.rpc("get_org_shift_range", { p_org: orgId, p_from: from, p_days: days }),
    supabase.from("ds_availability").select("instructor_id, weekday, start_time, end_time").eq("organization_id", orgId),
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
  ]);
  if (blocks.error) return { error: AppError.from(blocks.error).display() };
  return {
    blocks: (blocks.data ?? []) as AgendaBlock[],
    availability: (availability.data ?? []) as AgendaAvailability[],
    blocked: (blocked.data ?? []) as AgendaBlocked[],
    timeOff: (timeOff.data ?? []) as AgendaTimeOff[],
  };
}

export async function addAgendaClass(input: {
  orgId: string;
  driverId: string;
  vehicleId: string | null;
  date: string;
  start: string; // HH:MM
  end: string;
  studentId: string | null;
  note?: string | null;
}): Promise<{ error: string | null }> {
  if (!DATE.test(input.date) || !input.driverId) return { error: "Pick an instructor and a date." };
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
  driverId: string;
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

export async function deleteBlockedHours(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("ds_blocked_hours").delete().eq("id", id);
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin/shifts");
  return { error: null };
}
