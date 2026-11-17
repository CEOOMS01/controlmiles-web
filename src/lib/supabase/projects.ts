import { createClient } from "@supabase/supabase-js";

// Two databases, one website (2026-11-16): ControlMiles Fleet and the ControlMiles gig app each have their
// own Supabase project and share nothing. The site's own pages (admin, students, booking, billing) belong to
// Fleet and use NEXT_PUBLIC_SUPABASE_*. The gig app has no website of its own, but two PUBLIC routes serve it:
// redeeming a report code (/portal/verify -> /api/portal/redeem) and the trip route image
// (/api/trip-map/...). Those look in the gig project first (GIG_SUPABASE_*) and then in Fleet's.
//
// GIG_SUPABASE_* are server-only (no NEXT_PUBLIC_ prefix): nothing in the browser ever talks to the gig
// database through this site. If they are not set, only the default project is used, exactly as before.

export type Project = "gig" | "fleet";

type Config = { url: string; key: string };

function config(project: Project): Config | null {
  if (project === "gig") {
    const url = process.env.GIG_SUPABASE_URL;
    const key = process.env.GIG_SUPABASE_PUBLISHABLE_KEY;
    return url && key ? { url, key } : null;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

/** The projects a public, anonymous lookup (report code, trip image) should try, in order. */
export function publicProjects(): Project[] {
  const gig = config("gig");
  const fleet = config("fleet");
  const out: Project[] = [];
  if (gig && (!fleet || gig.url !== fleet.url)) out.push("gig");
  if (fleet) out.push("fleet");
  return out;
}

/** A cookie-less client with the publishable key for [project]: anonymous by design. */
export function anonClient(project: Project) {
  const c = config(project);
  if (!c) throw new Error(`Supabase project "${project}" is not configured`);
  return createClient(c.url, c.key);
}
