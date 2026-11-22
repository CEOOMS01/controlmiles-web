"use server";

// School bus, transport need codes (2026-11-21): the school's own catalog. RLS (operator or above) is the real
// gate; loading the Baltimore City model needs an owner or an admin (bus_seed_need_catalog checks it).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { AppError } from "@/lib/errors";
import type { FormResult } from "./actions";

const PATH = "/admin/school/needs";
const GROUPS = ["program", "equipment", "communication", "mobility"];

async function context() {
  const supabase = await createClient();
  const { profile } = await getAuthedProfile();
  return { supabase, orgId: profile?.default_org_id ?? null };
}

function fail(error: { message?: string }): FormResult {
  const m = error.message ?? "";
  if (m.includes("Only an admin or the owner")) return { error: "Only an admin or the owner can load the codes." };
  if (m.includes("bus_need_catalog_organization_id_code_key")) return { error: "That code already exists." };
  return { error: AppError.from(error).display() };
}

export async function loadBaltimoreCodes(): Promise<FormResult> {
  const { supabase, orgId } = await context();
  if (!orgId) return { error: "Not signed in." };
  const { error } = await supabase.rpc("bus_seed_need_catalog", { p_org: orgId, p_template: "baltimore_city" });
  if (error) return fail(error);
  revalidatePath(PATH);
  return { error: null };
}

export async function addNeedCode(_: FormResult, formData: FormData): Promise<FormResult> {
  const { supabase, orgId } = await context();
  if (!orgId) return { error: "Not signed in." };
  const grp = String(formData.get("grp") ?? "");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const label = String(formData.get("label") ?? "").trim();
  if (!GROUPS.includes(grp)) return { error: "Choose a group." };
  if (!/^[A-Z0-9]{1,8}$/.test(code)) return { error: "The code is 1 to 8 letters or digits, for example MA5." };
  if (!label || label.length > 80) return { error: "Write what the code means (up to 80 characters)." };
  const { data: last } = await supabase
    .from("bus_need_catalog")
    .select("sort")
    .eq("organization_id", orgId)
    .eq("grp", grp)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("bus_need_catalog")
    .insert({ organization_id: orgId, grp, code, label, sort: (last?.sort ?? 0) + 10 });
  if (error) return fail(error);
  revalidatePath(PATH);
  return { error: null };
}

export async function updateNeedCode(_: FormResult, formData: FormData): Promise<FormResult> {
  const { supabase } = await context();
  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!id) return { error: "Code not found." };
  if (!label || label.length > 80) return { error: "Write what the code means (up to 80 characters)." };
  const { error } = await supabase.from("bus_need_catalog").update({ label }).eq("id", id);
  if (error) return fail(error);
  revalidatePath(PATH);
  return { error: null };
}

/** A code in use is switched off, not deleted: students keep their history, the code stops being offered. */
export async function setNeedCodeActive(id: string, active: boolean): Promise<FormResult> {
  const { supabase } = await context();
  const { error } = await supabase.from("bus_need_catalog").update({ is_active: active }).eq("id", id);
  if (error) return fail(error);
  revalidatePath(PATH);
  revalidatePath("/admin/school/students");
  return { error: null };
}

export async function deleteNeedCode(id: string): Promise<FormResult> {
  const { supabase } = await context();
  const { error } = await supabase.from("bus_need_catalog").delete().eq("id", id);
  if (error) return fail(error);
  revalidatePath(PATH);
  revalidatePath("/admin/school/students");
  return { error: null };
}
