"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AddRouteState = { error: string | null; success: boolean };

export async function addRoute(
  _prevState: AddRouteState,
  formData: FormData,
): Promise<AddRouteState> {
  const orgId = String(formData.get("org_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const origin = String(formData.get("origin") ?? "").trim() || null;
  const destination = String(formData.get("destination") ?? "").trim() || null;
  const scheduledDate = String(formData.get("scheduled_date") ?? "").trim() || null;
  const driverId = String(formData.get("driver_id") ?? "").trim() || null;
  const vehicleId = String(formData.get("vehicle_id") ?? "").trim() || null;

  if (!orgId || !name) {
    return { error: "Enter a route name.", success: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", success: false };

  const { error } = await supabase.from("routes").insert({
    organization_id: orgId,
    name,
    origin,
    destination,
    scheduled_date: scheduledDate,
    assigned_driver_id: driverId,
    assigned_vehicle_id: vehicleId,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidatePath("/admin/routes");
  return { error: null, success: true };
}

export async function setRouteStatus(routeId: string, status: "active" | "closed") {
  const supabase = await createClient();
  // fn_freeze_closed_route (trigger) is what actually enforces
  // "closed means closed forever" -- this action can only ever move a
  // route toward closed, and once closed the underlying UPDATE itself
  // fails regardless of what this calls.
  await supabase.from("routes").update({ status }).eq("id", routeId);
  revalidatePath("/admin/routes");
}

export async function deleteDraftRoute(routeId: string) {
  const supabase = await createClient();
  // routes_delete_admin (RLS) only allows this while status='draft' --
  // a no-op for anything else.
  await supabase.from("routes").delete().eq("id", routeId);
  revalidatePath("/admin/routes");
}
