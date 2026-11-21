"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

// Reminders the instructors see on the Fleet app's home, one after another (2026-11-19). The table's policies
// (instructor_notices_write) are what limit these writes to the school's admins and operators.

export type NoticeState = { error: string | null; success: boolean };

export async function addInstructorNotice(_prev: NoticeState, formData: FormData): Promise<NoticeState> {
  const orgId = String(formData.get("org_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const endsOn = String(formData.get("ends_on") ?? "").trim();
  if (!orgId) return { error: "Invalid selection.", success: false };
  if (body === "") return { error: "Write the reminder first.", success: false };
  if (body.length > 300) return { error: "Keep it under 300 characters.", success: false };
  if (endsOn !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) return { error: "Pick a valid end date.", success: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("instructor_notices").insert({
    organization_id: orgId,
    body,
    ends_on: endsOn === "" ? null : endsOn,
    created_by: user?.id ?? null,
  });
  if (error) return { error: AppError.from(error).display(), success: false };

  revalidatePath("/admin");
  return { error: null, success: true };
}

/** Edit a reminder in place (text and end date) so it need not be deleted and written again. */
export async function updateInstructorNotice(_prev: NoticeState, formData: FormData): Promise<NoticeState> {
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const endsOn = String(formData.get("ends_on") ?? "").trim();
  if (!id) return { error: "Invalid selection.", success: false };
  if (body === "") return { error: "Write the reminder first.", success: false };
  if (body.length > 300) return { error: "Keep it under 300 characters.", success: false };
  if (endsOn !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) return { error: "Pick a valid end date.", success: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("instructor_notices")
    .update({ body, ends_on: endsOn === "" ? null : endsOn })
    .eq("id", id)
    .select("id");
  if (error) return { error: AppError.from(error).display(), success: false };
  if (!data || data.length === 0) return { error: "Could not save this reminder.", success: false };

  revalidatePath("/admin");
  return { error: null, success: true };
}

export async function setInstructorNoticeActive(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("instructor_notices").update({ is_active: formData.get("active") === "true" }).eq("id", id);
  revalidatePath("/admin");
}

export async function deleteInstructorNotice(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("instructor_notices").delete().eq("id", id);
  revalidatePath("/admin");
}
