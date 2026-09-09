"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type AddVehicleState = { error: string | null; success: boolean };

export async function addVehicle(
  _prevState: AddVehicleState,
  formData: FormData,
): Promise<AddVehicleState> {
  const orgId = String(formData.get("org_id") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim() || null;
  const make = String(formData.get("make") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const yearRaw = String(formData.get("year") ?? "").trim();
  const plate = String(formData.get("plate") ?? "").trim() || null;

  if (!orgId) {
    return { error: "Missing organization.", success: false };
  }

  const supabase = await createClient();
  // RLS (vehicles_insert) enforces that the caller is an admin/owner of
  // this org -- no RPC needed for a plain insert with no side effects.
  const { error } = await supabase.from("vehicles").insert({
    organization_id: orgId,
    owner_user_id: null,
    nickname,
    make,
    model,
    year: yearRaw ? Number(yearRaw) : null,
    plate,
  });

  if (error) {
    return { error: AppError.from(error).display(), success: false };
  }

  revalidatePath("/admin/vehicles");
  return { error: null, success: true };
}

export async function assignDriver(vehicleId: string, driverUserId: string | null) {
  const supabase = await createClient();

  if (driverUserId) {
    const { error } = await supabase.rpc("assign_vehicle_to_driver", {
      p_vehicle_id: vehicleId,
      p_driver_user_id: driverUserId,
    });
    if (error) throw new Error(AppError.from(error).display());
  } else {
    // Unassigning has no side effects to guard, so it's a plain
    // RLS-gated update rather than a special RPC case.
    const { error } = await supabase
      .from("vehicles")
      .update({ assigned_driver_id: null })
      .eq("id", vehicleId);
    if (error) throw new Error(AppError.from(error).display());
  }

  revalidatePath("/admin/vehicles");
}

export async function archiveVehicle(vehicleId: string) {
  const supabase = await createClient();
  // Never hard-deleted (matches vehicles.is_archived's own column
  // comment) -- sessions.vehicle_id would dangle on a real delete.
  await supabase.from("vehicles").update({ is_archived: true }).eq("id", vehicleId);
  revalidatePath("/admin/vehicles");
}
