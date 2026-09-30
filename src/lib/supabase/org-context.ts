import { cache } from "react";
import { createClient } from "./server";

// Real performance bug found live (2026-09-09, user-reported "slow on
// every click"): every /admin/* page.tsx independently called
// supabase.auth.getUser() + fetched the profiles row -- the SAME lookup
// admin/layout.tsx already does on every request (layouts don't share
// data with their pages via props in the App Router). That meant two
// separate auth.getUser() network round-trips (each one a real call to
// Supabase Auth to revalidate the JWT, not a local decode) plus two
// profiles queries on every single navigation, before the destination
// page could even start fetching its own data.
//
// React's cache() dedupes a call to the same function (with the same
// arguments) across a single render pass -- exactly Next.js's own
// documented pattern for sharing data between a layout and its page
// without prop-drilling. Calling this from both layout.tsx and a page.tsx
// during the same request now hits Supabase once, not twice.
// getClaims() instead of getUser() (2026-09-29, "Fleet tarda mucho en
// cargar"): this project signs sessions with an asymmetric key (ES256), so
// the JWT is verified locally against the cached public key -- no round
// trip to Supabase Auth on every page (the web ran in iad1, Supabase is in
// us-west-2: each call crossed the country). Same guarantee: a forged or
// expired token is rejected; RLS still guards every query.
export const getAuthedProfile = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) {
    return { user: null, profile: null };
  }
  const user = { id: claims.sub as string, email: (claims.email as string | undefined) ?? null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_org_id, first_name, account_type, legal_accepted_at")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
});
