"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

// Real fix, not a caveat left in place (explicit user request, 2026-09-17):
// vehicle_geofences (migration 20260825132900_create_vehicle_geofences.sql)
// and its violation-detection RPC path have been real and working since
// Fleet Phase 5, but only the mobile app ever had a UI to create or manage
// one -- the public pricing page and the private Enterprise Brief both
// advertise "draw a zone" without saying "mobile-only", and the web
// dashboard is where this project's own standing rule says heavy
// fleet-admin config should live. This is that missing web surface,
// reusing the exact same table/RLS the mobile app already writes to --
// no migration needed, direct-table RLS (vehicle_geofences_insert/
// _update/_delete) already restricts writes to an org admin/owner,
// mirrors vehicles/actions.ts's own addVehicle pattern.

export type Geofence = {
  id: string;
  vehicle_id: string;
  name: string;
  center_latitude: number;
  center_longitude: number;
  radius_meters: number;
  is_active: boolean;
  created_at: string;
};

export type CreateGeofenceState = { error: string | null; success: boolean };

export async function createGeofence(
  _prevState: CreateGeofenceState,
  formData: FormData,
): Promise<CreateGeofenceState> {
  const orgId = String(formData.get("org_id") ?? "");
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const lat = Number(formData.get("center_latitude"));
  const lng = Number(formData.get("center_longitude"));
  const radius = Number(formData.get("radius_meters"));

  if (!orgId || !vehicleId || !name) {
    return { error: "Pick a vehicle, click a point on the map, and name the zone.", success: false };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: "Click a point on the map to set the zone's center.", success: false };
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    return { error: "Enter a radius greater than 0.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_geofences").insert({
    organization_id: orgId,
    vehicle_id: vehicleId,
    name,
    center_latitude: lat,
    center_longitude: lng,
    radius_meters: radius,
  });

  if (error) {
    return { error: AppError.from(error).display(), success: false };
  }

  revalidatePath("/admin/geofences");
  return { error: null, success: true };
}

export async function setGeofenceActive(geofenceId: string, isActive: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicle_geofences")
    .update({ is_active: isActive })
    .eq("id", geofenceId);
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin/geofences");
  return { error: null };
}

export async function deleteGeofence(geofenceId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_geofences").delete().eq("id", geofenceId);
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin/geofences");
  return { error: null };
}
