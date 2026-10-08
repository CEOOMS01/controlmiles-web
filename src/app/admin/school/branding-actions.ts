"use server";

// Report branding (2026-10-09): the company name and logo printed at the top
// of the fleet's reports. Owner/admin only (set_report_branding + storage
// policies on the private `org_branding` bucket, path <org_id>/...).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { AppError } from "@/lib/errors";
import type { FormResult } from "./actions";

const MAX_BYTES = 1024 * 1024; // server actions accept ~1 MB bodies
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function saveReportBranding(_: FormResult, formData: FormData): Promise<FormResult> {
  const supabase = await createClient();
  const { profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!orgId) return { error: "Not authenticated." };

  const { data: org } = await supabase.from("organizations").select("report_logo_path").eq("id", orgId).maybeSingle();
  let logoPath: string | null = org?.report_logo_path ?? null;

  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    const ext = TYPES[file.type];
    if (!ext) return { error: "Use a PNG, JPG or WebP image." };
    if (file.size > MAX_BYTES) return { error: "The logo must be under 1 MB." };
    const path = `${orgId}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("org_branding")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) return { error: AppError.from(upErr).display() };
    if (logoPath) await supabase.storage.from("org_branding").remove([logoPath]);
    logoPath = path;
  } else if (formData.get("remove_logo") === "on" && logoPath) {
    await supabase.storage.from("org_branding").remove([logoPath]);
    logoPath = null;
  }

  const { error } = await supabase.rpc("set_report_branding", {
    p_organization_id: orgId,
    p_display_name: String(formData.get("display_name") ?? ""),
    p_logo_path: logoPath,
  });
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin/school/attendance");
  return { error: null };
}
