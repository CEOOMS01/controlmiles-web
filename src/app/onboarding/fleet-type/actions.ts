"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { AppError } from "@/lib/errors";
import { fleetTypeFrom } from "@/lib/fleet-profiles";

export type FleetTypeState = { error: string | null };

export async function chooseFleetType(_prev: FleetTypeState, formData: FormData): Promise<FleetTypeState> {
  const { profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!orgId) redirect("/admin");

  const fleetType = fleetTypeFrom(formData);
  if (!fleetType) return { error: "Choose your fleet type." };
  if (formData.get("confirm_locked") !== "on") {
    return { error: "Confirm that you understand the fleet type is set for this fleet." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_fleet_type", {
    p_organization_id: orgId,
    p_industry_template: fleetType,
  });
  // Already confirmed (another tab, or the app): nothing to do here.
  if (error && AppError.from(error) === AppError.fleetTypeLocked) redirect("/admin");
  if (error) return { error: AppError.from(error).display() };

  redirect("/admin");
}
