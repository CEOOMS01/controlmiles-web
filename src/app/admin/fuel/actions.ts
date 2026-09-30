"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type ActionResult = { error: string | null };

/** Dismiss (explained) / confirm (real problem) / reopen a fuel alert. */
export async function reviewFuelAnomaly(
  anomalyId: string,
  status: "open" | "dismissed" | "confirmed",
  note: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_fuel_anomaly", {
    p_anomaly_id: anomalyId,
    p_status: status,
    p_note: note,
  });
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin", "layout");
  return { error: null };
}

/** Tank size in gallons (empty clears it); re-checks recent receipts. */
export async function setTankCapacity(vehicleId: string, gallons: number | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_vehicle_tank_capacity", {
    p_vehicle_id: vehicleId,
    p_gallons: gallons,
  });
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin", "layout");
  return { error: null };
}
