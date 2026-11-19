"use server";

// A client orders a service from the school's portal (2026-11-18). Creates an order "pending payment";
// the client then pays the school itself. All checks and limits are repeated in ds_public_order.
// With the school's Banquest connected (2026-11-19) it also asks the ds-banquest function for a one-time pay link
// for this order, and orderStatus lets the page watch until the payment arrives.

import { createClient } from "@/lib/supabase/server";

export type OrderState = {
  error: string | null;
  done: {
    service: string;
    price_cents: number;
    order_id: string | null;
    // Banquest only: the school's payment page for this order, or null when it could not be made.
    pay_link: string | null;
    automatic: boolean;
  } | null;
  // What the client typed, so the form keeps it after an error (React clears uncontrolled fields).
  values?: { client_name: string; client_email: string; client_phone: string; note: string };
};

const MESSAGES: Record<string, string> = {
  NOT_AVAILABLE: "This school isn't taking online orders right now.",
  INVALID: "That service isn't available anymore. Reload the page.",
  NAME_REQUIRED: "Enter your full name.",
  EMAIL: "Check the email address.",
  CONTACT_REQUIRED: "Enter an email or phone number so the school can reach you.",
  BUSY: "Too many requests. Try again in a few minutes.",
};

const field = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);

async function payLinkFor(orderId: string): Promise<string | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ds-banquest/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
      body: JSON.stringify({ order_id: orderId }),
    });
    const r = (await res.json().catch(() => ({}))) as { ok?: boolean; link?: string };
    return res.ok && r.ok && typeof r.link === "string" && r.link.startsWith("https://") ? r.link : null;
  } catch {
    return null;
  }
}

export async function sendOrder(slug: string, _prev: OrderState, fd: FormData): Promise<OrderState> {
  // Honeypot: people never see this field; bots fill it.
  if (field(fd, "company", 100)) return { error: null, done: { service: "", price_cents: 0, order_id: null, pay_link: null, automatic: false } };

  const values = {
    client_name: field(fd, "client_name", 120),
    client_email: field(fd, "client_email", 120),
    client_phone: field(fd, "client_phone", 30),
    note: field(fd, "note", 500),
  };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ds_public_order", {
    p_slug: slug,
    p: { service_id: field(fd, "service_id", 40), ...values },
  });
  if (error || !data) {
    return { error: (error && MESSAGES[error.message]) || "Couldn't send the order. Try again.", done: null, values };
  }
  const r = data as { id: string; service: string; price_cents: number };

  let automatic = false;
  let payLink: string | null = null;
  const { data: page } = await supabase.rpc("ds_public_page", { p_slug: slug });
  if ((page as { payment?: { mode?: string } } | null)?.payment?.mode === "banquest") {
    automatic = true;
    payLink = await payLinkFor(r.id);
  }
  return { error: null, done: { service: r.service, price_cents: r.price_cents, order_id: r.id, pay_link: payLink, automatic } };
}

// The state of one order, for the page that waits for the payment (the order id is a secret only the client has).
export async function orderStatus(orderId: string): Promise<"pending_payment" | "paid" | "cancelled" | "unknown"> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) return "unknown";
  const supabase = await createClient();
  const { data } = await supabase.rpc("ds_public_order_status", { p_order: orderId });
  const s = (data as { status?: string } | null)?.status;
  return s === "paid" || s === "pending_payment" || s === "cancelled" ? s : "unknown";
}
