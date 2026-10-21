"use server";

// Driving school portal actions (2026-10-19, phase 2): no account, the link's
// token is the key. Every rule (plan, booking on, notice, window, max
// upcoming, balance, no double booking, cancellation policy, SMS consent)
// is checked by the database functions.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// A free time. The instructor isn't shown or chosen: the booking picks one
// at random among those free who teach in the student's language (2026-10-20).
export type Slot = { date: string; start: string; end: string };
export type PortalResult = { error: string | null; late?: boolean };

const MESSAGES: Record<string, string> = {
  LINK_NOT_ACTIVE: "This link isn't active. Ask your driving school for a new one.",
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

export async function getSlots(token: string): Promise<{ minutes: number; language: "en" | "es" | null; slots: Slot[] } | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("ds_portal_slots", { p_token: token });
  return (data as { minutes: number; language: "en" | "es" | null; slots: Slot[] } | null) ?? null;
}

export async function bookSlot(token: string, slot: Slot): Promise<PortalResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ds_portal_book", {
    p_token: token,
    p_date: slot.date,
    p_start: slot.start,
  });
  if (error) return { error: message(error) };
  revalidatePath(`/student/${token}`);
  return { error: null };
}

export async function cancelLesson(token: string, blockId: string): Promise<PortalResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ds_portal_cancel", { p_token: token, p_block: blockId });
  if (error) return { error: message(error) };
  revalidatePath(`/student/${token}`);
  return { error: null, late: !!(data as { late?: boolean } | null)?.late };
}

export async function setSms(token: string, on: boolean, phone: string): Promise<PortalResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ds_portal_set_sms", { p_token: token, p_on: on, p_phone: phone });
  if (error) return { error: message(error) };
  revalidatePath(`/student/${token}`);
  return { error: null };
}
