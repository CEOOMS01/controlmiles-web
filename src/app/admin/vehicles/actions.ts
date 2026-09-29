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
  // Found live 2026-09-29: an all-blank submit created a vehicle nobody
  // could identify ("CM-T9837  —  —" in the roster).
  if (!nickname && !plate && !make && !model) {
    return { error: "Give the vehicle at least a nickname or a plate.", success: false };
  }
  const year = yearRaw ? Number(yearRaw) : null;
  const maxYear = new Date().getFullYear() + 1;
  if (year !== null && (!Number.isInteger(year) || year < 1980 || year > maxYear)) {
    return { error: `Year must be between 1980 and ${maxYear}.`, success: false };
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
    year,
    plate,
  });

  if (error) {
    return { error: AppError.from(error).display(), success: false };
  }

  revalidatePath("/admin/roster");
  return { error: null, success: true };
}

export async function assignDriver(
  vehicleId: string,
  driverUserId: string | null,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  if (driverUserId) {
    const { error } = await supabase.rpc("assign_vehicle_to_driver", {
      p_vehicle_id: vehicleId,
      p_driver_user_id: driverUserId,
    });
    if (error) return { error: AppError.from(error).display() };
  } else {
    // Unassigning has no side effects to guard, so it's a plain
    // RLS-gated update rather than a special RPC case.
    const { error } = await supabase
      .from("vehicles")
      .update({ assigned_driver_id: null })
      .eq("id", vehicleId);
    if (error) return { error: AppError.from(error).display() };
  }

  revalidatePath("/admin/roster");
  return { error: null };
}

// New (Team+Vehicles unification, explicit user request, 2026-09-23):
// the driver-row vehicle picker on the unified Team page is the INVERSE
// of assignDriver above (pick a vehicle for a driver, not a driver for a
// vehicle). assign_vehicle_to_driver only ever sets ONE vehicle's own
// assigned_driver_id -- it has no concept of "this driver's previous
// vehicle" and won't clear it, so a driver reassigned from Van A to Van B
// would otherwise end up assigned to BOTH unless the caller clears the
// old one itself. Two calls, not a new RPC: the existing RPC already
// carries every real authorization check (org membership, tier, active
// member), duplicating that in a second function is exactly the kind of
// drift that leaves one path checked and the other not.
export async function setDriverVehicle(
  driverId: string,
  newVehicleId: string | null,
  previousVehicleId: string | null,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  if (previousVehicleId && previousVehicleId !== newVehicleId) {
    const { error } = await supabase
      .from("vehicles")
      .update({ assigned_driver_id: null })
      .eq("id", previousVehicleId);
    if (error) return { error: AppError.from(error).display() };
  }

  if (newVehicleId) {
    const { error } = await supabase.rpc("assign_vehicle_to_driver", {
      p_vehicle_id: newVehicleId,
      p_driver_user_id: driverId,
    });
    if (error) return { error: AppError.from(error).display() };
  }

  revalidatePath("/admin/roster");
  return { error: null };
}

export async function archiveVehicle(vehicleId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  // Never hard-deleted (matches vehicles.is_archived's own column
  // comment) -- sessions.vehicle_id would dangle on a real delete.
  //
  // BUG FIX (pedido explícito, 2026-09-09): nunca chequeaba el error de
  // Supabase -- un rechazo silencioso de RLS dejaba el vehículo activo
  // sin ningún aviso.
  const { error } = await supabase
    .from("vehicles")
    .update({ is_archived: true })
    .eq("id", vehicleId);
  if (error) {
    return { error: AppError.from(error).display() };
  }
  revalidatePath("/admin/roster");
  return { error: null };
}
