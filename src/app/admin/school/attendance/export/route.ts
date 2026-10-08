// CSV of the school attendance report (2026-10-09) for the contractor to send
// to the county school district. RLS limits it to the caller's fleet.

import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { attendanceCsv, loadAttendance } from "@/lib/school-attendance";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!user || !orgId) return new Response("Not authenticated", { status: 401 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!DATE.test(from) || !DATE.test(to)) return new Response("Invalid date range", { status: 400 });
  const routeId = url.searchParams.get("route") || null;

  const { data: org } = await supabase.from("organizations").select("name, timezone").eq("id", orgId).maybeSingle();
  const rows = await loadAttendance(supabase, orgId, from, to, routeId);
  const csv = attendanceCsv(rows, org?.timezone ?? "America/New_York");
  const name = `attendance-${(org?.name ?? "fleet").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${from}-to-${to}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
