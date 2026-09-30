"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

// Server-side only, for the same reason the old fetchStateMileage was
// moved here (2026-09-17): the browser Supabase client is never
// authenticated in this app (httpOnly auth cookies), so every RPC runs
// from the server client.

export type ActionResult = { error: string | null };

/** Mark a vehicle as an IFTA qualified motor vehicle, and its fuel. */
export async function setVehicleIfta(
  vehicleId: string,
  qualified: boolean,
  fuelType: "diesel" | "gasoline",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_vehicle_ifta", {
    p_vehicle_id: vehicleId,
    p_qualified: qualified,
    p_fuel_type: fuelType,
  });
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin/ifta");
  return { error: null };
}

/** Fix a receipt's IFTA fields (state, fuel type, tax paid at the pump). */
export async function correctFuelPurchase(
  purchaseId: string,
  stateCode: string | null,
  fuelType: "diesel" | "gasoline",
  taxPaid: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_fuel_purchase_ifta", {
    p_purchase_id: purchaseId,
    p_state_code: stateCode,
    p_fuel_type: fuelType,
    p_tax_paid: taxPaid,
  });
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin/ifta");
  return { error: null };
}
