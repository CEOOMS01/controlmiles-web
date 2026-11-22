// School bus: transport needs of a student (2026-11-21).
//
// What a driver and an aide must know at a stop: help to board, a vest, a wheelchair lift, an aide, how the
// student communicates. Each school has its own catalog of short codes (City Schools writes MA2, SV, WA, NV...);
// a student gets some of them plus a program and a short note. A diagnosis is never stored (FERPA / IDEA).
// Tables: bus_need_catalog, bus_student_needs (school bus service only); the driver reads them through
// bus_route_needs(route) in the app.

import type { SupabaseClient } from "@supabase/supabase-js";

export type NeedGroup = "program" | "equipment" | "communication" | "mobility";

export const NEED_GROUPS: { key: NeedGroup; label: string; hint: string; chip: string }[] = [
  { key: "mobility", label: "Mobility assistance", hint: "Help to board, find a seat, walk.", chip: "bg-accent/12 text-accent" },
  { key: "equipment", label: "Equipment and staff", hint: "Wheelchair, vest, car seat, oxygen, aide, nurse.", chip: "bg-danger/10 text-danger" },
  { key: "communication", label: "Communication", hint: "How the student communicates.", chip: "bg-warning/15 text-warning" },
  { key: "program", label: "Program", hint: "When the student attends. One per student.", chip: "bg-border/70 text-muted" },
];

export const GROUP_CHIP = Object.fromEntries(NEED_GROUPS.map((g) => [g.key, g.chip])) as Record<NeedGroup, string>;

export type NeedCode = { id: string; grp: NeedGroup; code: string; label: string; sort: number; is_active: boolean };

export type StudentNeeds = { program: NeedCode | null; needs: NeedCode[]; note: string | null };

export async function loadNeedCatalog(supabase: SupabaseClient, orgId: string): Promise<NeedCode[]> {
  const { data } = await supabase
    .from("bus_need_catalog")
    .select("id, grp, code, label, sort, is_active")
    .eq("organization_id", orgId)
    .order("grp")
    .order("sort")
    .order("code");
  return (data ?? []) as NeedCode[];
}

/** Needs by student for one school. Students without any are not in the map. */
export async function loadStudentNeeds(
  supabase: SupabaseClient,
  orgId: string,
  catalog: NeedCode[],
  students: { id: string; program_need_id?: string | null; transport_note?: string | null }[],
): Promise<Map<string, StudentNeeds>> {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const { data } = await supabase.from("bus_student_needs").select("student_id, need_id").eq("organization_id", orgId);
  const out = new Map<string, StudentNeeds>();
  const get = (id: string) => {
    let v = out.get(id);
    if (!v) out.set(id, (v = { program: null, needs: [], note: null }));
    return v;
  };
  for (const r of data ?? []) {
    const c = byId.get(r.need_id);
    if (c && c.is_active) get(r.student_id).needs.push(c);
  }
  for (const s of students) {
    const prog = s.program_need_id ? (byId.get(s.program_need_id) ?? null) : null;
    if (prog || s.transport_note) {
      const v = get(s.id);
      v.program = prog;
      v.note = s.transport_note ?? null;
    }
  }
  for (const v of out.values()) v.needs.sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code));
  return out;
}
