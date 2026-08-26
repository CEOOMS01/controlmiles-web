"use server";

import { createClient } from "@/lib/supabase/server";

export type GenerateState = {
  error: string | null;
  code: string | null;
  expiresAt: string | null;
};

export async function generateCode(
  _prevState: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");

  if (!startDate || !endDate) {
    return { error: "Choose a start and end date.", code: null, expiresAt: null };
  }

  const supabase = await createClient();

  // RLS + the RPC's own auth.uid() check are what actually gate this --
  // this route is also unreachable for a signed-out request per
  // middleware.ts, but the RPC never trusts that alone.
  const { data, error } = await supabase.rpc("generate_report_access_code", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_vehicle_id: null,
  });

  if (error) {
    return { error: error.message, code: null, expiresAt: null };
  }

  const row = data?.[0];
  if (!row) {
    return { error: "Could not generate a code. Try again.", code: null, expiresAt: null };
  }

  return { error: null, code: row.code, expiresAt: row.expires_at };
}
