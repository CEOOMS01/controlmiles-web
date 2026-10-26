"use server";

// Olympus Mont Systems LLC - ControlMiles
// src/app/admin/shifts/actions.ts
//
// Growth-tier feature (explicit user request, 2026-09-22): a recurring
// weekly work schedule per driver, separate from Routes (a one-off
// dispatched trip on a specific date). shifts_insert/_update/_delete
// (RLS) already restrict writes to an org operator/admin/owner, but that
// alone doesn't express the Growth-only product boundary -- checked here
// too, same defense-in-depth reasoning realtime-actions.ts and
// generate_report_access_code already use elsewhere in this app, so a
// Starter org can't create a shift by calling the REST API directly even
// though the UI never shows them the form.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { conflictMessage } from "@/lib/ds-conflicts";

async function requireGrowth(orgId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: features } = await supabase.rpc("fn_org_features", { p_org_id: orgId });
  if (!Array.isArray(features) || !features.includes("shift_schedules")) return AppError.featureNotInPlan.message;
  return null;
}

export type AddShiftState = { error: string | null; success: boolean };

export async function addShift(
  _prevState: AddShiftState,
  formData: FormData,
): Promise<AddShiftState> {
  const orgId = String(formData.get("org_id") ?? "");
  const driverId = String(formData.get("driver_id") ?? "");
  const vehicleId = String(formData.get("vehicle_id") ?? "").trim() || null;
  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const days = formData.getAll("days").map((d) => Number(d));

  if (!orgId || !driverId) {
    return { error: "Pick a driver.", success: false };
  }
  if (!startTime || !endTime) {
    return { error: "Enter a start and end time.", success: false };
  }
  if (days.length === 0) {
    return { error: "Pick at least one day.", success: false };
  }

  const tierError = await requireGrowth(orgId);
  if (tierError) return { error: tierError, success: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", success: false };

  // One row per selected day -- see the table's own migration comment
  // for why (a driver with a different schedule on different days needs
  // independently editable rows, not one row encoding a variable
  // weekly pattern).
  const { error } = await supabase.from("shifts").insert(
    days.map((day) => ({
      organization_id: orgId,
      driver_id: driverId,
      vehicle_id: vehicleId,
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
      notes,
      created_by: user.id,
    })),
  );

  if (error) {
    return { error: AppError.from(error).display(), success: false };
  }

  revalidatePath("/admin/shifts");
  return { error: null, success: true };
}

export async function setShiftActive(shiftId: string, isActive: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("shifts").update({ is_active: isActive }).eq("id", shiftId);
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin/shifts");
  return { error: null };
}

export async function deleteShift(shiftId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin/shifts");
  return { error: null };
}

// ── Hourly class blocks (2026-09-29, driving-school scheduling) ─────
// One-off blocks on a date. The weekly template above is materialized
// into the same table by get_org_shift_day (see migration
// 20260929170000_hourly_shift_blocks.sql).
export type AddClassBlockState = { error: string | null; success: boolean };

export async function addClassBlock(
  _prevState: AddClassBlockState,
  formData: FormData,
): Promise<AddClassBlockState> {
  const orgId = String(formData.get("org_id") ?? "");
  const driverId = String(formData.get("driver_id") ?? "");
  const vehicleId = String(formData.get("vehicle_id") ?? "").trim() || null;
  const blockDate = String(formData.get("block_date") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const studentId = String(formData.get("student_id") ?? "").trim() || null;

  if (!orgId || !driverId) return { error: "Pick an instructor.", success: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(blockDate)) return { error: "Pick a date.", success: false };
  if (!startTime || !endTime) return { error: "Enter a start and end time.", success: false };
  if (endTime <= startTime) return { error: "The class must end after it starts.", success: false };

  const supabase = await createClient();
  const { data: features } = await supabase.rpc("fn_org_features", { p_org_id: orgId });
  if (!Array.isArray(features) || !features.includes("classes")) return { error: AppError.featureNotInPlan.message, success: false };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", success: false };

  // One conflict rule for every way of adding a class (instructor, car, blocked
  // hours, days off); see ds_office_add_block.
  const { error } = await supabase.rpc("ds_office_add_block", {
    p_org: orgId,
    p_driver: driverId,
    p_vehicle: vehicleId,
    p_date: blockDate,
    p_start: startTime,
    p_end: endTime,
    p_student: features.includes("students") ? studentId : null,
    p_note: note,
  });
  if (error) return { error: conflictMessage(error.message), success: false };

  revalidatePath("/admin/shifts");
  return { error: null, success: true };
}

export async function setClassBlockCancelled(
  blockId: string,
  cancelled: boolean,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("shift_blocks")
    .update({ status: cancelled ? "cancelled" : "scheduled" })
    .eq("id", blockId)
    .in("status", cancelled ? ["scheduled"] : ["cancelled"]);
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin/shifts");
  return { error: null };
}

export async function deleteClassBlock(blockId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("shift_blocks")
    .delete()
    .eq("id", blockId)
    .eq("source", "one_off")
    .eq("status", "scheduled");
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin/shifts");
  return { error: null };
}
