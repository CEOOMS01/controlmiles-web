"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { AppError } from "@/lib/errors";
import { fleetTypeFrom } from "@/components/fleet-type-picker";

export type FleetTypeState = { error: string | null };

export async function chooseFleetType(_prev: FleetTypeState, formData: FormData): Promise<FleetTypeState> {
  const { profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!orgId) redirect("/admin");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_fleet_type", {
    p_organization_id: orgId,
    p_industry_template: fleetTypeFrom(formData),
  });
  if (error) return { error: AppError.from(error).display() };

  redirect("/admin");
}
