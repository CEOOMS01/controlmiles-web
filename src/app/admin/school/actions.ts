"use server";

// School transportation (2026-10-09): planning actions -- schools, students,
// school routes, ordered stops and who boards/alights where. RLS
// (`*_write_admin`, operator or above) is the real gate; the database also
// checks that a stop, its route and a student belong to the same fleet.
// Drivers never write these tables: the app uses the run RPCs.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { AppError } from "@/lib/errors";

export type FormResult = { error: string | null };

async function context() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id ?? null;
  return { supabase, userId: user?.id ?? null, orgId };
}

function text(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v.length > 0 ? v : null;
}

function num(formData: FormData, key: string): number | null {
  const v = text(formData, key);
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fail(error: unknown): FormResult {
  return { error: AppError.from(error).display() };
}

// --- "Not riding the bus" notices -------------------------------------------
// The office records what a parent told them (the parent's own notice comes
// from the Fleet app through the same database function). RLS on
// student_ride_notices has no write policy: only these functions write.

function noticeError(error: { message?: string }): FormResult {
  if (error.message?.includes("NOTICE_DATE_OUT_OF_RANGE")) {
    return { error: "That day can't be used: pick today or a day in the next 30 days." };
  }
  return fail(error);
}

export async function recordNoRide(_: FormResult, formData: FormData): Promise<FormResult> {
  const { supabase } = await context();
  const studentId = text(formData, "student_id");
  const date = text(formData, "date");
  const reason = text(formData, "reason");
  const part = text(formData, "part") ?? "am";
  if (!studentId || !date) return { error: "Student not found." };
  if (!reason) return { error: "Choose a reason." };
  const { error } = await supabase.rpc("report_student_no_ride", {
    p_student_id: studentId,
    p_date: date,
    p_part: part,
    p_reason: reason,
    p_will_attend: formData.get("will_attend") === "on",
    p_note: text(formData, "note"),
  });
  if (error) return noticeError(error);
  revalidatePath("/admin/school", "layout");
  return { error: null };
}

export async function undoNoRide(studentId: string, date: string): Promise<FormResult> {
  const { supabase } = await context();
  const { error } = await supabase.rpc("cancel_student_no_ride", { p_student_id: studentId, p_date: date });
  if (error) return noticeError(error);
  revalidatePath("/admin/school", "layout");
  return { error: null };
}

// --- Schools ---------------------------------------------------------------

export async function addSchool(_: FormResult, formData: FormData): Promise<FormResult> {
  const { supabase, orgId } = await context();
  const name = text(formData, "name");
  if (!orgId || !name) return { error: "Enter the school's name." };
  const { error } = await supabase.from("school_sites").insert({
    organization_id: orgId,
    name,
    address: text(formData, "address"),
    latitude: num(formData, "latitude"),
    longitude: num(formData, "longitude"),
  });
  if (error) return fail(error);
  revalidatePath("/admin/school/students");
  return { error: null };
}

export async function deleteSchool(id: string): Promise<FormResult> {
  const { supabase } = await context();
  const { error } = await supabase.from("school_sites").delete().eq("id", id);
  if (error) return fail(error);
  revalidatePath("/admin/school/students");
  return { error: null };
}

// --- Students --------------------------------------------------------------

function studentFields(formData: FormData) {
  const lastInitial = text(formData, "last_initial");
  const lat = num(formData, "home_latitude");
  const lon = num(formData, "home_longitude");
  const address = text(formData, "home_address")?.slice(0, 240) ?? null;
  const located = address != null && lat != null && lon != null;
  return {
    last_initial: lastInitial ? lastInitial.slice(0, 1).toUpperCase() : null,
    grade: text(formData, "grade"),
    school_site_id: text(formData, "school_site_id"),
    external_id: text(formData, "external_id"),
    // The coordinates only count when the address was picked from the search.
    home_address: address,
    home_latitude: located ? lat : null,
    home_longitude: located ? lon : null,
    parent1_name: text(formData, "parent1_name")?.slice(0, 120) ?? null,
    parent1_phone: text(formData, "parent1_phone")?.slice(0, 30) ?? null,
    parent2_name: text(formData, "parent2_name")?.slice(0, 120) ?? null,
    parent2_phone: text(formData, "parent2_phone")?.slice(0, 30) ?? null,
  };
}

export async function addStudent(_: FormResult, formData: FormData): Promise<FormResult> {
  const { supabase, orgId } = await context();
  const firstName = text(formData, "first_name");
  if (!orgId || !firstName) return { error: "Enter the student's first name." };
  const { error } = await supabase.from("students").insert({
    organization_id: orgId,
    first_name: firstName,
    ...studentFields(formData),
  });
  if (error) return fail(error);
  revalidatePath("/admin/school/students");
  return { error: null };
}

export async function updateStudent(_: FormResult, formData: FormData): Promise<FormResult> {
  const { supabase } = await context();
  const id = text(formData, "student_id");
  const firstName = text(formData, "first_name");
  if (!id || !firstName) return { error: "Enter the student's first name." };
  const { error } = await supabase
    .from("students")
    .update({ first_name: firstName, ...studentFields(formData) })
    .eq("id", id);
  if (error) return fail(error);
  revalidatePath("/admin/school/students");
  return { error: null };
}

/** Students are deactivated, never deleted: past runs keep their ridership. */
export async function deactivateStudent(id: string): Promise<FormResult> {
  const { supabase } = await context();
  const { error } = await supabase.from("students").update({ is_active: false }).eq("id", id);
  if (error) return fail(error);
  revalidatePath("/admin/school/students");
  return { error: null };
}

// --- School routes ---------------------------------------------------------

export type SuggestedStop = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  students: { id: string; name: string }[];
};
export type SuggestResult = {
  error: string | null;
  stops: SuggestedStop[];
  noAddress: number;
  alreadyRouted: number;
};

const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Students this close together share one stop. */
const SHARED_STOP_KM = 0.06;

/**
 * Suggested stops for one school's students (phase 1 of the smart order, a
 * plain distance rule): every student with a located home address who is not
 * already on a route of the same run becomes a stop, students within 60 m of
 * each other share one, and the stops run from the FARTHEST from the school to
 * the nearest (AM, ending at the school) or the other way round (PM, leaving
 * the school). The admin reviews and edits the list before saving.
 */
export async function suggestRouteStops(schoolId: string, runType: string, includeRouted = false): Promise<SuggestResult> {
  const empty = { stops: [], noAddress: 0, alreadyRouted: 0 };
  const { supabase, orgId } = await context();
  if (!orgId) return { error: "Not authenticated.", ...empty };
  if (runType !== "school_am" && runType !== "school_pm") return { error: "Choose AM or PM first.", ...empty };
  const { data: school } = await supabase
    .from("school_sites")
    .select("id, latitude, longitude")
    .eq("id", schoolId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!school || school.latitude == null || school.longitude == null) {
    return { error: "That school has no mapped address. Edit the school and pick its address from the search.", ...empty };
  }
  const { data: students, error } = await supabase
    .from("students")
    .select("id, first_name, last_initial, home_address, home_latitude, home_longitude")
    .eq("organization_id", orgId)
    .eq("school_site_id", schoolId)
    .eq("is_active", true);
  if (error) return { error: fail(error).error, ...empty };

  // Already on a live (draft or active) route of the same run: left out.
  const action = runType === "school_am" ? "board" : "alight";
  const { data: assigned } = await supabase
    .from("student_stop_assignments")
    .select("student_id, routes!inner(route_type, status)")
    .eq("organization_id", orgId)
    .eq("action", action)
    .eq("routes.route_type", runType)
    .neq("routes.status", "closed");
  const routed = new Set((assigned ?? []).map((a) => a.student_id));

  const located = (students ?? []).filter((s) => s.home_latitude != null && s.home_longitude != null && s.home_address);
  const noAddress = (students ?? []).length - located.length;
  // "Include students already on a route" is for rebuilding a school's routes: they move here on save.
  const free = includeRouted ? located : located.filter((s) => !routed.has(s.id));
  const alreadyRouted = includeRouted ? 0 : located.length - free.length;

  const withDistance = free
    .map((s) => ({
      s,
      d: haversineKm(school.latitude as number, school.longitude as number, s.home_latitude as number, s.home_longitude as number),
    }))
    .sort((a, b) => b.d - a.d);

  const clusters: { lat: number; lng: number; address: string; d: number; students: { id: string; name: string }[] }[] = [];
  for (const { s, d } of withDistance) {
    const lat = s.home_latitude as number;
    const lng = s.home_longitude as number;
    const name = `${s.first_name}${s.last_initial ? ` ${s.last_initial}.` : ""}`;
    const hit = clusters.find((c) => haversineKm(c.lat, c.lng, lat, lng) <= SHARED_STOP_KM);
    if (hit) hit.students.push({ id: s.id, name });
    else clusters.push({ lat, lng, address: s.home_address as string, d, students: [{ id: s.id, name }] });
  }
  // Farthest first for the morning run; the evening run is the reverse.
  if (runType === "school_pm") clusters.reverse();
  return {
    error: null,
    noAddress,
    alreadyRouted,
    stops: clusters.map((c) => ({
      name: c.address.split(",")[0] || c.students.map((x) => x.name).join(", "),
      address: c.address,
      lat: c.lat,
      lng: c.lng,
      distanceKm: Math.round(c.d * 10) / 10,
      students: c.students,
    })),
  };
}

type DraftStop = {
  students?: unknown;
  name?: unknown;
  address?: unknown;
  lat?: unknown;
  lng?: unknown;
  time?: unknown;
  kind?: unknown;
  radius?: unknown;
};

/**
 * Route builder (map): create the route, its crew and its ordered stops in one
 * go. "Save draft" keeps it out of the drivers' app; "Publish" makes it live.
 * Students are assigned to the stops afterwards, on the route page.
 */
export async function createSchoolRouteWithStops(_: FormResult, formData: FormData): Promise<FormResult> {
  const { supabase, orgId, userId } = await context();
  if (!orgId || !userId) return { error: "Not authenticated." };
  const name = text(formData, "name");
  const routeType = text(formData, "route_type");
  if (!name) return { error: "Enter a route name." };
  if (routeType !== "school_am" && routeType !== "school_pm") return { error: "Choose AM or PM." };
  const days = formData
    .getAll("service_days")
    .map((d) => Number(d))
    .filter((d) => d >= 1 && d <= 7);
  if (days.length === 0) return { error: "Choose at least one service day." };

  let draft: DraftStop[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("stops_json") ?? "[]"));
    if (Array.isArray(parsed)) draft = parsed as DraftStop[];
  } catch {
    return { error: "The stops could not be read. Reload the page and try again." };
  }
  if (draft.length === 0) return { error: "Add at least one stop on the map." };
  if (draft.length > 80) return { error: "A route can have up to 80 stops." };
  const stopStudents: string[][] = [];
  const stops: {
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
    scheduled_time: string | null;
    stop_kind: string;
    radius_meters: number;
  }[] = [];
  for (const [i, d] of draft.entries()) {
    const lat = Number(d.lat);
    const lng = Number(d.lng);
    const stopName = String(d.name ?? "").trim().slice(0, 120);
    if (!stopName) return { error: `Stop ${i + 1} needs a name.` };
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return { error: `Stop ${i + 1} has no valid location.` };
    }
    const time = String(d.time ?? "");
    const kind = String(d.kind ?? "pickup");
    const radius = Number(d.radius);
    stopStudents.push(
      Array.isArray(d.students)
        ? (d.students as unknown[]).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x))
        : [],
    );
    stops.push({
      name: stopName,
      address: String(d.address ?? "").trim().slice(0, 240) || null,
      latitude: lat,
      longitude: lng,
      scheduled_time: /^\d{2}:\d{2}(:\d{2})?$/.test(time) ? time : null,
      stop_kind: kind === "school" || kind === "dropoff" ? kind : "pickup",
      radius_meters: Number.isFinite(radius) ? Math.min(500, Math.max(20, Math.round(radius))) : 80,
    });
  }

  const publish = text(formData, "publish") === "1";
  const { data: route, error } = await supabase
    .from("routes")
    .insert({
      organization_id: orgId,
      name: name.slice(0, 120),
      route_type: routeType,
      school_site_id: text(formData, "school_site_id"),
      assigned_driver_id: text(formData, "driver_id"),
      assigned_vehicle_id: text(formData, "vehicle_id"),
      monitor_id: text(formData, "monitor_id"),
      monitor_name: text(formData, "monitor_id") ? null : (text(formData, "monitor_name")?.slice(0, 80) ?? null),
      scheduled_start_time: text(formData, "scheduled_start_time"),
      service_days: days,
      status: publish ? "active" : "draft",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !route) return fail(error);

  const { data: inserted, error: stopsError } = await supabase
    .from("route_stops")
    .insert(stops.map((s, i) => ({ ...s, route_id: route.id, organization_id: orgId, seq: i + 1 })))
    .select("id, seq");
  // Students on each stop: they board there in the morning, get off there in the afternoon.
  let assignError: unknown = null;
  if (!stopsError && inserted) {
    const bySeq = new Map(inserted.map((r) => [r.seq, r.id]));
    const rows = stopStudents.flatMap((ids, i) =>
      ids.map((student_id) => ({
        organization_id: orgId,
        route_id: route.id,
        stop_id: bySeq.get(i + 1) as string,
        student_id,
        action: routeType === "school_am" ? "board" : "alight",
      })),
    );
    if (rows.length > 0) {
      assignError = (await supabase.from("student_stop_assignments").insert(rows)).error;
      // A student rides one route per run: moving them here takes them off their old one.
      if (!assignError) {
        const { data: others } = await supabase
          .from("routes")
          .select("id")
          .eq("organization_id", orgId)
          .eq("route_type", routeType)
          .neq("status", "closed")
          .neq("id", route.id);
        const otherIds = (others ?? []).map((r) => r.id);
        if (otherIds.length > 0) {
          await supabase
            .from("student_stop_assignments")
            .delete()
            .in("student_id", rows.map((r) => r.student_id))
            .eq("action", routeType === "school_am" ? "board" : "alight")
            .in("route_id", otherIds);
        }
      }
    }
  }
  if (stopsError || assignError) {
    // No half-built route: remove it (a draft can be deleted).
    await supabase.from("routes").update({ status: "draft" }).eq("id", route.id);
    await supabase.from("routes").delete().eq("id", route.id);
    return fail(stopsError ?? assignError);
  }
  revalidatePath("/admin/school/routes");
  revalidatePath("/admin/school");
  redirect(`/admin/school/routes/${route.id}`);
}

/** Make a draft route live: the drivers see it in the app on its service days. */
export async function publishSchoolRoute(routeId: string): Promise<FormResult> {
  const { supabase } = await context();
  const { error } = await supabase.from("routes").update({ status: "active" }).eq("id", routeId).eq("status", "draft");
  if (error) return fail(error);
  revalidatePath(`/admin/school/routes/${routeId}`);
  revalidatePath("/admin/school/routes");
  revalidatePath("/admin/school");
  return { error: null };
}

/**
 * Edit a school route's details (name, school, start time, service days).
 * The run (AM/PM) is not editable: its stops and who boards or gets off at
 * each one only make sense for that run. Crew has its own form.
 */
export async function updateSchoolRoute(_: FormResult, formData: FormData): Promise<FormResult> {
  const { supabase } = await context();
  const routeId = text(formData, "route_id");
  const name = text(formData, "name");
  if (!routeId) return { error: "Route not found." };
  if (!name) return { error: "Enter a route name." };
  const days = formData
    .getAll("service_days")
    .map((d) => Number(d))
    .filter((d) => d >= 1 && d <= 7);
  if (days.length === 0) return { error: "Choose at least one service day." };
  const { error } = await supabase
    .from("routes")
    .update({
      name: name.slice(0, 120),
      school_site_id: text(formData, "school_site_id"),
      scheduled_start_time: text(formData, "scheduled_start_time"),
      service_days: days,
    })
    .eq("id", routeId);
  if (error) return fail(error);
  revalidatePath(`/admin/school/routes/${routeId}`);
  revalidatePath(`/admin/school/live/${routeId}`);
  revalidatePath("/admin/school/routes");
  revalidatePath("/admin/school");
  return { error: null };
}

export type DeleteRouteResult = FormResult & { archived?: boolean };

/**
 * Delete a school route. A route that never ran is removed with its stops and
 * assignments. One that has run keeps its history (attendance and the "no child
 * left on board" checks), so it is archived instead: closed, off the lists and
 * out of the drivers' app.
 */
export async function deleteSchoolRoute(routeId: string): Promise<DeleteRouteResult> {
  const { supabase } = await context();
  const { count, error: runsError } = await supabase
    .from("route_runs")
    .select("id", { count: "exact", head: true })
    .eq("route_id", routeId);
  if (runsError) return fail(runsError);
  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from("routes")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", routeId);
    if (error) return fail(error);
    revalidatePath("/admin/school/routes");
    revalidatePath("/admin/school");
    return { error: null, archived: true };
  }
  // Only draft routes can be deleted (row policy): step it back to draft first.
  const { error: draftError } = await supabase.from("routes").update({ status: "draft" }).eq("id", routeId);
  if (draftError) return fail(draftError);
  const { data: gone, error } = await supabase.from("routes").delete().eq("id", routeId).select("id");
  if (error) return fail(error);
  if (!gone || gone.length === 0) return { error: "Could not delete the route." };
  revalidatePath("/admin/school/routes");
  revalidatePath("/admin/school");
  return { error: null, archived: false };
}

/** The route's crew: driver, bus and bus monitor (aide, by name). */
export async function saveSchoolRouteCrew(_: FormResult, formData: FormData): Promise<FormResult> {
  const { supabase } = await context();
  const routeId = text(formData, "route_id");
  if (!routeId) return { error: "Route not found." };
  const { error } = await supabase
    .from("routes")
    .update({
      assigned_driver_id: text(formData, "driver_id"),
      assigned_vehicle_id: text(formData, "vehicle_id"),
      // A monitor with the app wins; the name is for monitors without it.
      monitor_id: text(formData, "monitor_id"),
      monitor_name: text(formData, "monitor_id") ? null : (text(formData, "monitor_name")?.slice(0, 80) ?? null),
    })
    .eq("id", routeId);
  if (error) return fail(error);
  revalidatePath(`/admin/school/routes/${routeId}`);
  revalidatePath(`/admin/school/live/${routeId}`);
  revalidatePath("/admin/school/routes");
  revalidatePath("/admin/school");
  return { error: null };
}

/**
 * Substitute for ONE day (plan section 8): driver, bus and/or monitor for
 * this route on `service_date` only; the regular crew is untouched. Empty
 * fields keep the regular crew. The substitute driver sees the route in the
 * app that day (the server uses the effective crew).
 */
export async function setSubstitute(_: FormResult, formData: FormData): Promise<FormResult> {
  const { supabase, orgId, userId } = await context();
  const routeId = text(formData, "route_id");
  const date = text(formData, "service_date");
  if (!orgId || !routeId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Route not found." };
  const driverId = text(formData, "driver_id");
  const vehicleId = text(formData, "vehicle_id");
  const monitorId = text(formData, "monitor_id");
  const monitor = monitorId ? null : (text(formData, "monitor_name")?.slice(0, 80) ?? null);
  if (!driverId && !vehicleId && !monitorId && !monitor) return { error: "Choose a substitute driver, bus or monitor." };
  const { error } = await supabase.from("route_crew_overrides").upsert(
    {
      organization_id: orgId,
      route_id: routeId,
      service_date: date,
      driver_id: driverId,
      vehicle_id: vehicleId,
      monitor_id: monitorId,
      monitor_name: monitor,
      reason: text(formData, "reason")?.slice(0, 200) ?? null,
      created_by: userId,
    },
    { onConflict: "route_id,service_date" },
  );
  if (error) return fail(error);
  revalidatePath(`/admin/school/live/${routeId}`);
  revalidatePath("/admin/school");
  return { error: null };
}

export async function clearSubstitute(routeId: string, date: string): Promise<FormResult> {
  const { supabase } = await context();
  const { error } = await supabase.from("route_crew_overrides").delete().eq("route_id", routeId).eq("service_date", date);
  if (error) return fail(error);
  revalidatePath(`/admin/school/live/${routeId}`);
  revalidatePath("/admin/school");
  return { error: null };
}

// --- Stops -----------------------------------------------------------------

export async function addStop(_: FormResult, formData: FormData): Promise<FormResult> {
  const { supabase, orgId } = await context();
  const routeId = text(formData, "route_id");
  const name = text(formData, "name");
  const lat = num(formData, "latitude");
  const lon = num(formData, "longitude");
  if (!orgId || !routeId) return { error: "Route not found." };
  if (!name) return { error: "Give the stop a name." };
  if (lat == null || lon == null) {
    return { error: "Pick the address from the suggestions so the stop has a map location." };
  }
  const { data: last } = await supabase
    .from("route_stops")
    .select("seq")
    .eq("route_id", routeId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  const kind = text(formData, "stop_kind");
  const radius = num(formData, "radius_meters");
  // A morning route ends at the school: a pick-up added later goes just before
  // it, not after it. The stops from the school on move up one place, last
  // first, so (route, seq) is never duplicated.
  let seq = (last?.seq ?? 0) + 1;
  if (kind !== "school") {
    const { data: route } = await supabase.from("routes").select("route_type").eq("id", routeId).maybeSingle();
    if (route?.route_type === "school_am") {
      const { data: school } = await supabase
        .from("route_stops")
        .select("seq")
        .eq("route_id", routeId)
        .eq("stop_kind", "school")
        .order("seq", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (school) {
        const { data: tail } = await supabase
          .from("route_stops")
          .select("id, seq")
          .eq("route_id", routeId)
          .gte("seq", school.seq)
          .order("seq", { ascending: false });
        for (const t of tail ?? []) {
          const { error: e } = await supabase.from("route_stops").update({ seq: t.seq + 1 }).eq("id", t.id);
          if (e) return fail(e);
        }
        seq = school.seq;
      }
    }
  }
  const { error } = await supabase.from("route_stops").insert({
    route_id: routeId,
    organization_id: orgId,
    seq,
    name,
    address: text(formData, "address"),
    latitude: lat,
    longitude: lon,
    scheduled_time: text(formData, "scheduled_time"),
    stop_kind: kind === "school" || kind === "dropoff" ? kind : "pickup",
    radius_meters: radius != null ? Math.min(500, Math.max(20, Math.round(radius))) : 80,
  });
  if (error) return fail(error);
  revalidatePath(`/admin/school/routes/${routeId}`);
  return { error: null };
}

/** Swaps a stop with its neighbour. Three writes so the (route, seq)
 *  uniqueness never sees two stops with the same number. */
export async function moveStop(routeId: string, stopId: string, direction: "up" | "down"): Promise<FormResult> {
  const { supabase } = await context();
  const { data: stops, error } = await supabase
    .from("route_stops")
    .select("id, seq")
    .eq("route_id", routeId)
    .order("seq");
  if (error || !stops) return fail(error);
  const i = stops.findIndex((s) => s.id === stopId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= stops.length) return { error: null };
  const a = stops[i];
  const b = stops[j];
  for (const [id, seq] of [
    [a.id, -1_000_000 - a.seq],
    [b.id, a.seq],
    [a.id, b.seq],
  ] as const) {
    const { error: e } = await supabase.from("route_stops").update({ seq }).eq("id", id);
    if (e) return fail(e);
  }
  revalidatePath(`/admin/school/routes/${routeId}`);
  return { error: null };
}

export async function deleteStop(routeId: string, stopId: string): Promise<FormResult> {
  const { supabase } = await context();
  const { error } = await supabase.from("route_stops").delete().eq("id", stopId);
  if (error) return fail(error);
  revalidatePath(`/admin/school/routes/${routeId}`);
  return { error: null };
}

// --- Riders ----------------------------------------------------------------

export async function assignStudent(_: FormResult, formData: FormData): Promise<FormResult> {
  const { supabase, orgId } = await context();
  const routeId = text(formData, "route_id");
  const stopId = text(formData, "stop_id");
  const studentId = text(formData, "student_id");
  const action = text(formData, "action");
  if (!orgId || !routeId || !stopId || !studentId) return { error: "Choose a student." };
  if (action !== "board" && action !== "alight") return { error: "Choose board or get off." };
  const { error } = await supabase
    .from("student_stop_assignments")
    .upsert(
      { organization_id: orgId, route_id: routeId, stop_id: stopId, student_id: studentId, action },
      { onConflict: "student_id,route_id,action" },
    );
  if (error) return fail(error);
  revalidatePath(`/admin/school/routes/${routeId}`);
  return { error: null };
}

export async function unassignStudent(routeId: string, assignmentId: string): Promise<FormResult> {
  const { supabase } = await context();
  const { error } = await supabase.from("student_stop_assignments").delete().eq("id", assignmentId);
  if (error) return fail(error);
  revalidatePath(`/admin/school/routes/${routeId}`);
  return { error: null };
}
