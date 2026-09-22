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

async function requireGrowth(orgId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: tier } = await supabase.rpc("fn_org_effective_tier", { p_org_id: orgId });
  if (tier !== "growth" && tier !== "enterprise") return "Shift scheduling is a Growth plan feature.";
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
