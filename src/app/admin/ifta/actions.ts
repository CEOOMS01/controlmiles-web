"use server";

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type StateMileageRow = {
  state_code: string;
  state_name: string;
  miles: number;
};

// Real fix, root cause, not a caveat (found live, 2026-09-17 while
// completing the IFTA feature per explicit user request): this report
// used to call compute_state_mileage straight from the browser Supabase
// client (@/lib/supabase/client). That client can never actually be
// authenticated in this app -- middleware.ts explicitly forces
// httpOnly:true on every Supabase auth cookie (deliberate XSS hardening
// from the pre-launch security audit), which is invisible to
// document.cookie and therefore to createBrowserClient(). Every browser-
// side call was silently running as the `anon` role instead of
// `authenticated`, and anon has no EXECUTE grant on this function -- so
// the report showed a permission-denied error (mangled to
// "[object Object] (450)" by AppError.from, a second bug: String() on a
// non-Error PostgrestError doesn't read .message) for every single admin,
// on every load, since the day it shipped. Verified live via a patched
// window.fetch capturing the real 401 body before writing this fix.
// The fix: move the call server-side, the same pattern already used by
// every other authenticated mutation in this app (roster/actions.ts,
// etc.) -- the server client reads the httpOnly cookies directly and
// carries a real "authenticated" session, no client-side auth needed.
export async function fetchStateMileage(
  orgId: string,
  startDate: string,
  endDate: string,
  vehicleId: string | null,
): Promise<{ rows: StateMileageRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("compute_state_mileage", {
    p_organization_id: orgId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_vehicle_id: vehicleId,
  });

  if (error) {
    return { rows: [], error: AppError.from(error).display() };
  }

  return { rows: (data ?? []) as StateMileageRow[], error: null };
}
