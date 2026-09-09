import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type FleetExportRow = {
  user_id: string;
  driver_name: string | null;
  driver_display_id: string | null;
  total_miles: number;
  total_sessions: number;
  vehicles: { display_id: string | null; make: string | null; model: string | null; nickname: string | null }[];
};

export type FleetExportResult = {
  orgName: string;
  startDate: string;
  endDate: string;
  rows: FleetExportRow[];
};

/**
 * Shared by both /api/admin/export/csv and /api/admin/export/pdf --
 * resolves the caller's own org from their session (never trusts a
 * client-supplied org id) and calls get_fleet_export_data, which
 * itself re-checks is_org_admin_or_owner server-side. Throws a plain
 * Error with a message safe to show the caller on any failure.
 */
export async function loadFleetExportData(startDate: string, endDate: string): Promise<FleetExportResult> {
  if (!startDate || !endDate) {
    throw new Error("Missing date range.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_org_id")
    .eq("id", user.id)
    .maybeSingle();
  const orgId = profile?.default_org_id;
  if (!orgId) {
    throw new Error("No organization.");
  }

  const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).maybeSingle();

  const { data, error } = await supabase.rpc("get_fleet_export_data", {
    p_org_id: orgId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    throw new Error(AppError.from(error).display());
  }

  return {
    orgName: org?.name ?? "Fleet",
    startDate,
    endDate,
    rows: (data ?? []) as FleetExportRow[],
  };
}

function vehiclesLabel(vehicles: FleetExportRow["vehicles"]): string {
  return vehicles
    .map((v) => {
      const name = [v.make, v.model].filter(Boolean).join(" ");
      return v.display_id ? `${name || v.nickname || "Vehicle"} (${v.display_id})` : name || v.nickname || "";
    })
    .filter(Boolean)
    .join("; ");
}

export function toCsv(result: FleetExportResult): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["Driver", "Driver ID", "Total Miles", "Sessions", "Vehicles"];
  const lines = [header.map(escape).join(",")];

  for (const row of result.rows) {
    lines.push(
      [
        row.driver_name ?? "",
        row.driver_display_id ?? "",
        row.total_miles.toFixed(1),
        String(row.total_sessions),
        vehiclesLabel(row.vehicles),
      ]
        .map(escape)
        .join(","),
    );
  }

  const totalMiles = result.rows.reduce((sum, r) => sum + r.total_miles, 0);
  const totalSessions = result.rows.reduce((sum, r) => sum + r.total_sessions, 0);
  lines.push(["TOTAL", "", totalMiles.toFixed(1), String(totalSessions), ""].map(escape).join(","));

  return lines.join("\r\n");
}

export { vehiclesLabel };
