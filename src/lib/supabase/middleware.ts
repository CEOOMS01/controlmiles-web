import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { STAY_SIGNED_IN_COOKIE, authCookieOptions, staySignedInFrom } from "@/lib/auth/session-persistence";

function buildCsp(nonce: string, frameAncestors = "'none'") {
  // React dev mode needs eval() for its debugging tools (stack
  // reconstruction across environments); it never uses eval() in
  // production, so this only widens the policy locally, not in prod.
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;

  return [
    "default-src 'self'",
    // challenges.cloudflare.com: Cloudflare Turnstile captcha on the driving
    // school public enrollment page (script, its iframe and its requests).
    `script-src ${scriptSrc} https://challenges.cloudflare.com`,
    "frame-src https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    // *.tile.openstreetmap.org: still used by admin/geofences and
    // portal/verify's Leaflet maps (not touched in the 2026-09-21 swap
    // below -- only the fleet live map moved off it).
    // protomaps.github.io: sprite PNG for the fleet map's self-hosted
    // MapLibre basemap (see fleet-map-inner.tsx).
    // *.supabase.co: REAL BUG FOUND AND FIXED (2026-09-22, while
    // verifying the report portal's weekly odometer photos) -- this
    // domain was never in img-src at all. The Report Portal
    // (portal/verify) has rendered <img src={photoUrl}> from Supabase
    // Storage since that feature shipped, meaning every odometer photo
    // was silently blocked by CSP the entire time, with nothing in the
    // UI to explain why the tile stayed empty -- confirmed live via a
    // console CSP violation while testing this exact page.
    "img-src 'self' data: https://*.tile.openstreetmap.org https://protomaps.github.io https://*.supabase.co",
    "font-src 'self'",
    // MapLibre GL JS parses/renders vector tiles off the main thread via
    // a Web Worker constructed from a blob: URL internally -- without
    // this, the fleet map's worker creation is silently blocked by CSP
    // (falls back to default-src, which doesn't cover worker-src).
    "worker-src 'self' blob:",
    // Address search runs on our server (src/lib/geocode.ts): the browser no longer calls
    // any geocoder, so none is listed here (Photon was removed 2026-10-24).
    // cgc-cre.vercel.app: CGC Core, where the pageview beacon
    // (src/components/pageview-beacon.tsx) reports to (2026-09-21).
    // protomaps.github.io: glyphs (.pbf) + sprite JSON for the fleet
    // map's basemap style, fetched via fetch()/XHR, not <img>.
    // controlmiles-tiles.integrations-55b.workers.dev: the Worker that serves the
    // .pmtiles file from R2 in production (infra/cloudflare/tiles-worker.js in
    // controlmiles-backend). r2.dev is kept for the old direct address.
    // r2.dev / your R2 custom domain: the self-hosted .pmtiles file
    // itself (NEXT_PUBLIC_FLEET_MAP_PMTILES_URL) -- *.r2.dev covers
    // Cloudflare's default public bucket subdomain; replace/extend with
    // your own custom domain once the bucket uses one instead.
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cgc-cre.vercel.app https://protomaps.github.io https://*.r2.dev https://controlmiles-tiles.integrations-55b.workers.dev https://challenges.cloudflare.com",
    // 'none' everywhere except a driving school's public booking page
    // (/book/<slug>), which the school may embed on its own site
    // (ds_public_origins; see proxy.ts).
    `frame-ancestors ${frameAncestors}`,
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/**
 * Refreshes the Supabase session cookie on every request so a driver's
 * login doesn't silently expire mid-session. Also the one place that
 * decides whether an unauthenticated request to a protected route gets
 * redirected -- server-side, not left to a client-side check that a
 * modified/no-JS request could skip. And generates a per-request CSP
 * nonce -- a static `script-src 'self'` (tried first) blocks Next.js's
 * own inline hydration/RSC-streaming scripts, breaking every client
 * interaction silently (confirmed live: click handlers never fired,
 * console showed CSP violations). `'strict-dynamic'` + a real nonce is
 * the correct fix, not loosening to `'unsafe-inline'`.
 */
export async function updateSession(request: NextRequest, frameAncestors?: string, rewriteTo?: URL) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, frameAncestors);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // A school's own address serves its /book page (proxy.ts, 2026-10-20).
  const pass = () =>
    rewriteTo
      ? NextResponse.rewrite(rewriteTo, { request: { headers: requestHeaders } })
      : NextResponse.next({ request: { headers: requestHeaders } });

  let supabaseResponse = pass();
  supabaseResponse.headers.set("Content-Security-Policy", csp);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = pass();
          supabaseResponse.headers.set("Content-Security-Policy", csp);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              // "Keep me signed in": persistent (90 d) or browser-session
              // cookie -- see session-persistence.ts. Always httpOnly.
              authCookieOptions(options, staySignedInFrom(request.cookies.get(STAY_SIGNED_IN_COOKIE)?.value)),
            ),
          );
        },
      },
    },
  );

  // getClaims(): verifies the session JWT locally (ES256 signing key) and
  // still refreshes an expired session through the cookie handlers above --
  // no Supabase Auth round trip on every request (see org-context.ts).
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? claimsData.claims : null;

  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/portal/generate") ||
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/api/admin");

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set("Content-Security-Policy", csp);
    return redirectResponse;
  }

  return supabaseResponse;
}
