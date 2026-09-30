"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { AppError } from "@/lib/errors";
import { BRANCH_COOKIE } from "@/lib/branch-scope";

export type ActionResult = { error: string | null };

/** The sidebar's branch filter ("" = all branches). */
export async function selectBranch(branchId: string) {
  const jar = await cookies();
  if (branchId) {
    jar.set(BRANCH_COOKIE, branchId, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  } else {
    jar.delete(BRANCH_COOKIE);
  }
  revalidatePath("/admin", "layout");
}

export type BranchFormState = { error: string | null; success: boolean };

export async function addBranch(_prev: BranchFormState, formData: FormData): Promise<BranchFormState> {
  const { profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  const name = String(formData.get("name") ?? "").trim();
  if (!orgId) return { error: "Missing organization.", success: false };
  if (!name) return { error: "Give the branch a name.", success: false };
  const supabase = await createClient();
  const { error } = await supabase.from("branches").insert({
    organization_id: orgId,
    name,
    address: String(formData.get("address") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
  });
  if (error) return { error: AppError.from(error).display(), success: false };
  revalidatePath("/admin", "layout");
  return { error: null, success: true };
}

export async function archiveBranch(branchId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("branches").update({ is_archived: true }).eq("id", branchId);
  if (error) return { error: AppError.from(error).display() };
  const jar = await cookies();
  if (jar.get(BRANCH_COOKIE)?.value === branchId) jar.delete(BRANCH_COOKIE);
  revalidatePath("/admin", "layout");
  return { error: null };
}

export async function setVehicleBranch(vehicleId: string, branchId: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_vehicle_branch", { p_vehicle_id: vehicleId, p_branch_id: branchId });
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin", "layout");
  return { error: null };
}

/** value: a branch id, "any" (can work at any branch) or "" (none). */
export async function setMemberBranch(userId: string, value: string): Promise<ActionResult> {
  const { profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!orgId) return { error: "Missing organization." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_branch", {
    p_organization_id: orgId,
    p_user_id: userId,
    p_branch_id: value && value !== "any" ? value : null,
    p_any_branch: value === "any",
  });
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin", "layout");
  return { error: null };
}
