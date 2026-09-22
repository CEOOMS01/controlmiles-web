"use server";

import { createClient } from "@/lib/supabase/server";

// Real fix, root cause (found live, 2026-09-17): every "use client"
// component that needs a live Supabase Realtime subscription (fleet-map.tsx
// today) can never authenticate its own browser Supabase client --
// middleware.ts deliberately forces httpOnly on every auth cookie
// (pre-launch XSS hardening), which is invisible to document.cookie, so
// createBrowserClient() always ends up on the `anon` role. Realtime's
// postgres_changes enforces RLS using the connecting role, and every
// RLS-protected table here (vehicles included) only grants SELECT to
// `authenticated` -- so a Realtime channel opened from the browser
// silently receives zero events, forever, with no visible error.
//
// The fix is NOT to relax httpOnly (that reopens the exact XSS risk it
// was added to close) and NOT to call supabase.auth.setSession()
// client-side (that would hand the long-lived refresh token to JS memory,
// which is the same risk in a different shape). Supabase's own documented
// answer for this exact situation is realtime.setAuth(accessToken) --
// scopes only the Realtime websocket handshake to a short-lived token.
// This action is how the client gets that token: the server client here
// reads it from the httpOnly cookies (which middleware.ts already keeps
// refreshed on every request), so it's always minting a currently-valid
// token, never a stale client-side copy.
export async function getRealtimeAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  // Growth-only feature, second layer (explicit user requirement,
  // 2026-09-18): the admin dashboard page already hides FleetMap
  // entirely for a non-Growth org, but this action is the one that would
  // actually leak live vehicle positions over the Realtime socket if
  // called directly -- same fn_org_effective_tier check as everywhere
  // else this tier is enforced.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.default_org_id) return null;

  const { data: tier } = await supabase.rpc("fn_org_effective_tier", {
    p_org_id: profile.default_org_id,
  });
  if (tier !== "growth" && tier !== "enterprise") return null;

  return session.access_token;
}

// Same httpOnly-cookie token-minting as getRealtimeAccessToken above, but
// WITHOUT the Growth-tier gate -- that gate is specific to FleetMap being
// a paid feature, not a security boundary (the real boundary is each
// table's own RLS, enforced by Realtime using whatever role the token
// carries). Added as its own function rather than relaxing the existing
// one so FleetMap's gating can never regress by way of an unrelated
// caller (geofence-alerts-feed.tsx) needing a token on every tier.
export async function getRealtimeAccessTokenAnyTier(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
