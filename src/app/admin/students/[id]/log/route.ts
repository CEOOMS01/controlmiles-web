// Hour log PDF for the state (driving school phase 2, 2026-10-20): office
// staff of a school whose plan has state records. ds_student_classes checks
// the caller is staff of the student's school; the permit number is printed
// only for an owner or admin (same rule as the student page).

import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { getOrgFeatures } from "@/lib/fleet-features";
import { driverLabel, fleetDriverIds } from "@/lib/driver-label";
import { buildHourLogPdf } from "@/lib/hour-log-pdf";
import { NO_PROGRAM, PROGRAM_COLUMNS, type Program } from "@/lib/driving-school";

export const runtime = "nodejs";

type ClassRow = {
  block_date: string;
  start_time: string;
  end_time: string;
  instructor_id: string | null;
  vehicle_id: string | null;
  minutes: number | null;
  night_minutes: number | null;
  miles: number | null;
};

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!user || !orgId) return notFound();
  if (!(await getOrgFeatures(orgId)).has("state_records")) return notFound();

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("ds_students")
    .select("first_name, last_name, program_id, state_cert_type, state_cert_number")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!student) return notFound();

  const [{ data: me }, { data: org }, { data: classRows, error }, { data: programRows }, { data: vehicles }, fleetIds] =
    await Promise.all([
      supabase.from("organization_members").select("member_role").eq("organization_id", orgId).eq("user_id", user.id).maybeSingle(),
      supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
      supabase.rpc("ds_student_classes", { p_student: id }),
      supabase.from("ds_programs").select(PROGRAM_COLUMNS).eq("organization_id", orgId),
      supabase.from("vehicles").select("id, nickname, make, model, display_id, plate").eq("organization_id", orgId),
      fleetDriverIds(supabase, orgId),
    ]);
  if (error) return notFound();

  const isAdmin = me?.member_role === "owner" || me?.member_role === "admin";
  const { data: priv } = isAdmin
    ? await supabase.from("ds_student_private").select("permit_number").eq("student_id", id).maybeSingle()
    : { data: null };

  const rows = ((classRows ?? []) as ClassRow[])
    .filter((c) => Number(c.minutes ?? 0) > 0)
    .sort((a, b) => (a.block_date + a.start_time).localeCompare(b.block_date + b.start_time));

  const instructorIds = [...new Set(rows.map((r) => r.instructor_id).filter(Boolean))] as string[];
  const { data: people } = instructorIds.length
    ? await supabase.from("profiles").select("id, first_name, last_name").in("id", instructorIds)
    : { data: [] };
  const personName = new Map((people ?? []).map((p) => [p.id, driverLabel(p, fleetIds.get(p.id), "Instructor")]));
  const carName = new Map(
    (vehicles ?? []).map((v) => [
      v.id,
      [[v.make, v.model].filter(Boolean).join(" ") || v.nickname || "Car", v.plate ? `(${v.plate})` : v.display_id ? `(${v.display_id})` : ""]
        .filter(Boolean)
        .join(" "),
    ]),
  );
  const program = ((programRows ?? []) as Program[]).find((p) => p.id === student.program_id) ?? NO_PROGRAM;

  const pdf = await buildHourLogPdf({
    school: org?.name ?? "",
    student: `${student.first_name} ${student.last_name}`,
    program: program.name,
    permit: priv?.permit_number ?? null,
    state_certificate: student.state_cert_number
      ? `${student.state_cert_type ?? ""} ${student.state_cert_number}`.trim()
      : null,
    required_minutes: program.required_minutes,
    required_night_minutes: program.required_night_minutes,
    rows: rows.map((r) => ({
      date: r.block_date,
      start: r.start_time.slice(0, 5),
      end: r.end_time.slice(0, 5),
      instructor: (r.instructor_id && personName.get(r.instructor_id)) || "—",
      vehicle: (r.vehicle_id && carName.get(r.vehicle_id)) || "—",
      minutes: Number(r.minutes ?? 0),
      night_minutes: Number(r.night_minutes ?? 0),
      miles: Number(r.miles ?? 0),
    })),
    printed_at: new Date().toLocaleDateString("en-US", { dateStyle: "long" }),
  });

  const fileName = `hour-log-${student.last_name}-${student.first_name}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
