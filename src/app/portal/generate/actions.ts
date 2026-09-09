"use server";

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type GenerateState = {
  error: string | null;
  code: string | null;
  expiresAt: string | null;
};

// Monday (ISO) of the week containing `dateStr` -- mirrors the SQL in
// submit_vehicle_odometer_checkpoint's v_week_start calc
// (p_capture_date - (isodow - 1)), so the checkpoint query below includes
// the partial week the report's start_date falls into, not just whole
// weeks starting on/after it.
function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const isoDow = ((d.getUTCDay() + 6) % 7) + 1; // Mon=1 .. Sun=7
  d.setUTCDate(d.getUTCDate() - (isoDow - 1));
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// The "odometers" Storage bucket is private -- stored URLs are broken
// getPublicUrl() links (same gotcha documented in the mobile app's
// odometer_capture_service.dart resolveViewableImageUrl). Extract the
// object path so it can be re-signed.
const EVIDENCE_MARKER = "/object/public/odometers/";
function extractStoragePath(url: string | null): string | null {
  if (!url) return null;
  const idx = url.indexOf(EVIDENCE_MARKER);
  if (idx === -1) return null;
  return url.slice(idx + EVIDENCE_MARKER.length);
}

async function signOrNull(
  supabase: Awaited<ReturnType<typeof createClient>>,
  url: string | null,
): Promise<string | null> {
  const path = extractStoragePath(url);
  if (!path) return null;
  // storage.objects RLS for this bucket is scoped to the *uploader's* own
  // auth.uid() folder (not "owns the vehicle") -- a checkpoint photo
  // captured by a different driver on a shared fleet vehicle will fail to
  // sign here. That's expected: the numeric reading still shows in the
  // report, the photo itself is just omitted rather than erroring the
  // whole report generation.
  const { data, error } = await supabase.storage
    .from("odometers")
    .createSignedUrl(path, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}

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

  // Weekly odometer checkpoint photos (mobile's vehicle_detail_screen.dart
  // equivalent, now surfaced on the shared report too). Fetched and signed
  // as the driver's own authenticated session -- RLS already scopes
  // vehicle_odometer_checkpoints to vehicles the driver owns/is assigned
  // to/shares an org with, so no service-role key is needed here.
  const { data: checkpointRows } = await supabase
    .from("vehicle_odometer_checkpoints")
    .select(
      "vehicle_id, week_start_date, start_odometer_value, start_odometer_image_url, end_odometer_value, end_odometer_image_url, vehicles(nickname, make, model, year, plate)",
    )
    .gte("week_start_date", mondayOf(startDate))
    .lte("week_start_date", endDate)
    .order("week_start_date", { ascending: true });

  const weeklyCheckpoints = await Promise.all(
    (checkpointRows ?? []).map(async (row) => {
      const vehicle = Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles;
      return {
        vehicle: vehicle
          ? {
              nickname: vehicle.nickname,
              make: vehicle.make,
              model: vehicle.model,
              year: vehicle.year,
              plate: vehicle.plate,
            }
          : null,
        week_start_date: row.week_start_date,
        week_end_date: addDays(row.week_start_date, 6),
        start_odometer_value: row.start_odometer_value,
        start_odometer_photo_url: await signOrNull(supabase, row.start_odometer_image_url),
        end_odometer_value: row.end_odometer_value,
        end_odometer_photo_url: await signOrNull(supabase, row.end_odometer_image_url),
      };
    }),
  );

  // RLS + the RPC's own auth.uid() check are what actually gate this --
  // this route is also unreachable for a signed-out request per
  // middleware.ts, but the RPC never trusts that alone.
  const { data, error } = await supabase.rpc("generate_report_access_code", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_vehicle_id: null,
    p_weekly_checkpoints: weeklyCheckpoints,
  });

  if (error) {
    return { error: AppError.from(error).display(), code: null, expiresAt: null };
  }

  const row = data?.[0];
  if (!row) {
    return { error: "Could not generate a code. Try again.", code: null, expiresAt: null };
  }

  return { error: null, code: row.code, expiresAt: row.expires_at };
}
