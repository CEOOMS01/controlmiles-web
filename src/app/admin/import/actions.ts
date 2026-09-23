"use server";

// Olympus Mont Systems LLC - ControlMiles
// src/app/admin/import/actions.ts
//
// Bulk CSV import for vehicles and drivers (explicit user request,
// 2026-09-22): a real Samsara-leaving prospect brings 16-50 vehicles at
// once -- one-row-at-a-time forms (add-vehicle-form.tsx, add-driver-slot-
// form.tsx) are fine for ongoing fleet changes but a bad first-day
// experience for a bulk onboarding. Reuses the exact same insert/RPC each
// single-row form already calls (vehicles_insert RLS, create_driver_slot)
// row by row -- no new database surface, no new authorization path, just
// a loop with a per-row result instead of a single pass/fail.
//
// Drivers go through create_driver_slot (the in-person claim-code path),
// not create_driver_invite (the email path): a bulk CSV can't guarantee
// every email is real/correctly spelled, and firing send-driver-invite
// per bad row means real emails bouncing or going to the wrong person.
// The claim-code path has no email dependency at all -- the admin hands
// out (or exports) the codes themselves.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type VehicleImportRow = {
  nickname: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
};

export type VehicleImportResult = {
  row: VehicleImportRow;
  ok: boolean;
  error: string | null;
};

export async function bulkAddVehicles(
  orgId: string,
  rows: VehicleImportRow[],
): Promise<{ error: string | null; results: VehicleImportResult[] }> {
  if (!orgId) return { error: "Missing organization.", results: [] };
  if (rows.length === 0) return { error: "No rows to import.", results: [] };
  // Same order of magnitude as a real prospect's fleet (16-50 vehicles) --
  // not a hard product limit, just a guardrail against a malformed/huge
  // file silently hammering the database row by row.
  if (rows.length > 500) {
    return { error: "Import is limited to 500 rows at a time.", results: [] };
  }

  const supabase = await createClient();
  const results: VehicleImportResult[] = [];

  for (const row of rows) {
    const { error } = await supabase.from("vehicles").insert({
      organization_id: orgId,
      owner_user_id: null,
      nickname: row.nickname,
      make: row.make,
      model: row.model,
      year: row.year,
      plate: row.plate,
    });
    results.push({ row, ok: !error, error: error ? AppError.from(error).display() : null });
  }

  revalidatePath("/admin/roster");
  return { error: null, results };
}

export type DriverImportRow = { firstName: string; lastName: string };

export type DriverImportResult = {
  row: DriverImportRow;
  ok: boolean;
  displayId: string | null;
  claimCode: string | null;
  error: string | null;
};

export async function bulkAddDriverSlots(
  orgId: string,
  rows: DriverImportRow[],
): Promise<{ error: string | null; results: DriverImportResult[] }> {
  if (!orgId) return { error: "Missing organization.", results: [] };
  if (rows.length === 0) return { error: "No rows to import.", results: [] };
  if (rows.length > 500) {
    return { error: "Import is limited to 500 rows at a time.", results: [] };
  }

  const supabase = await createClient();
  const results: DriverImportResult[] = [];

  for (const row of rows) {
    const { data, error } = await supabase.rpc("create_driver_slot", {
      p_org_id: orgId,
      p_first_name: row.firstName,
      p_last_name: row.lastName,
    });
    const created = data?.[0];
    results.push({
      row,
      ok: !error && !!created,
      displayId: created?.display_id ?? null,
      claimCode: created?.claim_code ?? null,
      error: error ? AppError.from(error).display() : null,
    });
  }

  revalidatePath("/admin/roster");
  return { error: null, results };
}
