"use server";

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

// Real fix, not a caveat left in place (explicit user request, 2026-09-17,
// completing the Fleet self-serve billing gap the private Enterprise
// Brief flagged): calling supabase.functions.invoke from a CLIENT
// component here would hit the exact same bug just fixed in ifta-report
// and fleet-map -- the browser Supabase client can never carry a real
// session (middleware.ts's intentional httpOnly cookies), so the edge
// function would see an anon caller and reject it. Routed through Server
// Actions instead, same pattern as roster/actions.ts's own
// send-driver-invite call.

// FunctionsHttpError keeps the edge function's JSON body on .context.
async function readFunctionError(error: unknown): Promise<string | null> {
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json();
      return typeof body?.error === "string" ? body.error : null;
    }
  } catch {
    // Not a JSON body -- fall back to the generic message.
  }
  return null;
}

export type CheckoutState = { error: string | null; url: string | null };

export async function startFleetCheckout(
  orgId: string,
  tier: "starter" | "growth",
): Promise<CheckoutState> {
  const supabase = await createClient();
  // The seat count is computed server-side from the org's vehicles; the
  // browser never chooses how many vehicles are billed.
  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: { scope: "fleet", organization_id: orgId, tier },
  });

  if (error) {
    const body = await readFunctionError(error);
    if (body === "ALREADY_SUBSCRIBED") {
      return { error: "This fleet already has an active plan. Use Manage billing to change it.", url: null };
    }
    return { error: AppError.from(error).display(), url: null };
  }
  if (data?.configured === false) {
    return { error: "Fleet billing isn't set up yet. Contact support@controlmiles.com.", url: null };
  }
  if (!data?.url) {
    return { error: "Could not start checkout. Try again.", url: null };
  }
  return { error: null, url: data.url };
}

export async function openFleetBillingPortal(orgId: string): Promise<CheckoutState> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("create-portal-session", {
    body: { organization_id: orgId },
  });

  if (error) {
    return { error: AppError.from(error).display(), url: null };
  }
  if (data?.configured === false || !data?.url) {
    return { error: "No active subscription to manage yet.", url: null };
  }
  return { error: null, url: data.url };
}
