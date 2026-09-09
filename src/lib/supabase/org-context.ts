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
export const getAuthedProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_org_id, first_name, account_type")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
});
