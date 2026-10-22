"use server";

// Driving school portal actions (2026-10-19, phase 2), shared by both ways
// in (2026-10-22): the per-student link (/student/<token>, the token is the
// key) and the client portal (/lessons, the session cookie is the key and
// the student is one the parent or adult may see). Every rule (plan,
// booking on, notice, window, max upcoming, balance, no double booking,
// cancellation policy, SMS consent, who may see which student) is checked
// by the database functions.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { lessonsSession } from "@/lib/lessons-session";

// A free time. The instructor isn't shown or chosen: the booking picks one
// at random among those free who teach in the student's language (2026-10-20).
export type Slot = { date: string; start: string; end: string };
export type PortalResult = { error: string | null; late?: boolean };
/** How the page was opened: a student's link, or a client signed in to /lessons. */
export type PortalAccess = { token: string } | { student: string };

const MESSAGES: Record<string, string> = {
  LINK_NOT_ACTIVE: "This link isn't active. Ask your driving school for a new one.",
  SESSION_ENDED: "You've been signed out. Sign in again to continue.",
  NO_ACCESS: "This student isn't on your profile.",
  BOOKING_OFF: "Online booking isn't available right now.",
  TOO_MANY_UPCOMING: "You already have the most upcoming lessons your school allows. Cancel one or wait until after your next lesson.",
  NO_BALANCE: "You don't have enough lesson hours left. Ask your school for a new package.",
  SLOT_TAKEN: "That time was just taken. Please pick another one.",
  CLASS_NOT_CANCELLABLE: "That lesson can't be cancelled anymore.",
  PHONE_REQUIRED: "Enter your mobile number.",
};

function message(e: { message?: string } | null): string {
  const text = String(e?.message ?? "");
  const key = Object.keys(MESSAGES).find((k) => text.includes(k));
  return key ? MESSAGES[key] : "Something went wrong. Please try again.";
}

const pathOf = (a: PortalAccess) => ("token" in a ? `/student/${a.token}` : `/lessons/student/${a.student}`);

/** Calls the token function or the client-session one with the same arguments. */
async function call(a: PortalAccess, name: "slots" | "book" | "cancel" | "set_sms", args: Record<string, unknown>) {
  const supabase = await createClient();
  if ("token" in a) {
    return supabase.rpc(`ds_portal_${name}`, { p_token: a.token, ...args });
  }
  // No cookie: the database answers SESSION_ENDED for the empty session.
  const session = (await lessonsSession()) ?? "";
  return supabase.rpc(`ds_client_${name}`, { p_session: session, p_student: a.student, ...args });
}

export async function getSlots(a: PortalAccess): Promise<{ minutes: number; language: "en" | "es" | null; slots: Slot[] } | null> {
  const { data } = await call(a, "slots", {});
  return (data as { minutes: number; language: "en" | "es" | null; slots: Slot[] } | null) ?? null;
}

export async function bookSlot(a: PortalAccess, slot: Slot): Promise<PortalResult> {
  const { error } = await call(a, "book", { p_date: slot.date, p_start: slot.start });
  if (error) return { error: message(error) };
  revalidatePath(pathOf(a));
  return { error: null };
}

export async function cancelLesson(a: PortalAccess, blockId: string): Promise<PortalResult> {
  const { data, error } = await call(a, "cancel", { p_block: blockId });
  if (error) return { error: message(error) };
  revalidatePath(pathOf(a));
  return { error: null, late: !!(data as { late?: boolean } | null)?.late };
}

export async function setSms(a: PortalAccess, on: boolean, phone: string): Promise<PortalResult> {
  const { error } = await call(a, "set_sms", { p_on: on, p_phone: phone });
  if (error) return { error: message(error) };
  revalidatePath(pathOf(a));
  return { error: null };
}
