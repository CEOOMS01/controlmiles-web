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

export async function addStudent(_: FormResult, formData: FormData): Promise<FormResult> {
  const { supabase, orgId } = await context();
  const firstName = text(formData, "first_name");
  if (!orgId || !firstName) return { error: "Enter the student's first name." };
  const lastInitial = text(formData, "last_initial");
  const { error } = await supabase.from("students").insert({
    organization_id: orgId,
    first_name: firstName,
    last_initial: lastInitial ? lastInitial.slice(0, 1).toUpperCase() : null,
    grade: text(formData, "grade"),
    school_site_id: text(formData, "school_site_id"),
    external_id: text(formData, "external_id"),
  });
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

type DraftStop = {
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

  const { error: stopsError } = await supabase
    .from("route_stops")
    .insert(stops.map((s, i) => ({ ...s, route_id: route.id, organization_id: orgId, seq: i + 1 })));
  if (stopsError) {
    // No half-built route: remove it (a draft can be deleted).
    await supabase.from("routes").update({ status: "draft" }).eq("id", route.id);
    await supabase.from("routes").delete().eq("id", route.id);
    return fail(stopsError);
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
  const { error } = await supabase.from("route_stops").insert({
    route_id: routeId,
    organization_id: orgId,
    seq: (last?.seq ?? 0) + 1,
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
