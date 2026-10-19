"use server";

// Olympus Mont Systems LLC - ControlMiles Web
// src/app/admin/approvals/actions.ts
//
// Trip approval (sales fleets on Growth, 2026-10-19): set_trip_approval
// checks the admin role, the plan feature and that the trip is finished.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type ApprovalState = { error: string | null };

export async function decideTrip(_prev: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const sessionId = String(formData.get("session_id") ?? "");
  const raw = String(formData.get("status") ?? "");
  const status = raw === "approved" || raw === "rejected" ? raw : null;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!sessionId) return { error: "Invalid trip." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_trip_approval", {
    p_session_id: sessionId,
    p_status: status,
    p_note: note,
  });
  if (error) return { error: AppError.from(error).display() };
  revalidatePath("/admin/approvals");
  return { error: null };
}
