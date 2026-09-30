// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/branch-scope.ts
//
// Branches (2026-09-30, explicit user request; Samsara "Tags" / Motive
// "Groups"): the admin picks a branch in the sidebar and every page shows
// only that branch's vehicles and drivers. The choice is a per-browser
// cookie (it's a view filter, not data). A vehicle is in a branch by its
// branch_id; a driver by their home branch, or always when they "can work
// at any branch".

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const BRANCH_COOKIE = "cm_branch";

export type Branch = { id: string; name: string; address: string | null; phone: string | null };

export type BranchScope = {
  branches: Branch[];
  /** null = all branches */
  current: Branch | null;
  /** null when not filtering */
  vehicleIds: Set<string> | null;
  driverIds: Set<string> | null;
  vehicleIn: (id: string | null | undefined) => boolean;
  driverIn: (id: string | null | undefined) => boolean;
};

export const getBranchScope = cache(async (orgId: string): Promise<BranchScope> => {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("branches")
    .select("id, name, address, phone")
    .eq("organization_id", orgId)
    .eq("is_archived", false)
    .order("name");
  const branches = (rows ?? []) as Branch[];

  const selected = (await cookies()).get(BRANCH_COOKIE)?.value;
  const current = branches.find((b) => b.id === selected) ?? null;
  if (!current) {
    return { branches, current: null, vehicleIds: null, driverIds: null, vehicleIn: () => true, driverIn: () => true };
  }

  const [{ data: vehicles }, { data: members }] = await Promise.all([
    supabase.from("vehicles").select("id").eq("organization_id", orgId).eq("branch_id", current.id),
    supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .or(`branch_id.eq.${current.id},any_branch.eq.true`),
  ]);
  const vehicleIds = new Set((vehicles ?? []).map((v) => v.id as string));
  const driverIds = new Set((members ?? []).map((m) => m.user_id as string));
  return {
    branches,
    current,
    vehicleIds,
    driverIds,
    vehicleIn: (id) => !!id && vehicleIds.has(id),
    driverIn: (id) => !!id && driverIds.has(id),
  };
});
