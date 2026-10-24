"use server";

// Driving school portal actions (2026-10-19, phase 2): no account, the link's
// token is the key. Every rule (plan, booking on, notice, window, max
// upcoming, balance, no double booking, cancellation policy, SMS consent)
// is checked by the database functions.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STR, type Lang } from "./strings";

// A free time. The instructor isn't shown or chosen: the booking picks one
// at random among those free who teach in the student's language (2026-10-20).
export type Slot = { date: string; start: string; end: string };
export type PortalResult = { error: string | null; late?: boolean };

const CODES = ["LINK_NOT_ACTIVE", "BOOKING_OFF", "TOO_MANY_UPCOMING", "NO_BALANCE", "SLOT_TAKEN", "CLASS_NOT_CANCELLABLE", "PHONE_REQUIRED"] as const;

function message(e: { message?: string } | null, lang: Lang): string {
  const text = String(e?.message ?? "");
  const key = CODES.find((k) => text.includes(k));
  return key ? STR[lang][key] : STR[lang].GENERIC;
}

export async function getSlots(token: string): Promise<{ minutes: number; language: "en" | "es" | null; slots: Slot[] } | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("ds_portal_slots", { p_token: token });
  return (data as { minutes: number; language: "en" | "es" | null; slots: Slot[] } | null) ?? null;
}

export async function bookSlot(token: string, slot: Slot, lang: Lang = "en"): Promise<PortalResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ds_portal_book", {
    p_token: token,
    p_date: slot.date,
    p_start: slot.start,
  });
  if (error) return { error: message(error, lang) };
  revalidatePath(`/student/${token}`);
  return { error: null };
}

export async function cancelLesson(token: string, blockId: string, lang: Lang = "en"): Promise<PortalResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ds_portal_cancel", { p_token: token, p_block: blockId });
  if (error) return { error: message(error, lang) };
  revalidatePath(`/student/${token}`);
  return { error: null, late: !!(data as { late?: boolean } | null)?.late };
}

export async function setSms(token: string, on: boolean, phone: string, lang: Lang = "en"): Promise<PortalResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ds_portal_set_sms", { p_token: token, p_on: on, p_phone: phone });
  if (error) return { error: message(error, lang) };
  revalidatePath(`/student/${token}`);
  return { error: null };
}
