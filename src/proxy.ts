// Olympus Mont Systems LLC - ControlMiles
// src/proxy.ts  (Next.js 16 renombró la convención `middleware` a `proxy`)
//
// Aquí conviven DOS responsabilidades y el orden importa:
//
//   1. next-intl: resuelve el idioma de la URL y reescribe /es/pricing ->
//      /[locale]/pricing. Solo aplica a páginas públicas.
//   2. Supabase: refresca la cookie de sesión en cada request, genera el
//      nonce del CSP y -- lo más importante -- REDIRIGE A /login cualquier
//      petición no autenticada a /admin, /api/admin o /portal/generate.
//
// Por qué el idioma va primero y con salida temprana: las rutas protegidas
// (/admin, /api/admin, /portal/generate) NO están traducidas, así que
// meterlas por el middleware de idioma solo añadiría reescrituras inútiles
// y el riesgo de que una redirección de idioma se cuele antes que la
// comprobación de sesión. Se atajan arriba y van directas a updateSession,
// exactamente como antes de que existiera el i18n.
//
// Por qué se fusionan las cookies a mano al final: los dos middlewares
// construyen su propia NextResponse. Si se devuelve la de idioma sin más,
// se pierden las cookies de sesión que Supabase acaba de refrescar y el
// usuario se desloguea solo al navegar. Si se devuelve la de Supabase sin
// más, se pierde la reescritura de idioma y /es/pricing da 404.

import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

/** Rutas que NO pasan por el enrutado de idioma.
 *
 *  Esta lista tiene que coincidir exactamente con lo que NO vive bajo
 *  src/app/[locale]/. Si una ruta falta aquí, el middleware la reescribe a
 *  /[locale]/<ruta>, no encuentra archivo y devuelve 404 -- pasó en la
 *  primera versión de esto con /login y /portal/verify, detectado probando
 *  las rutas una a una en el navegador (login devolvía 404, que es
 *  exactamente la clase de regresión que no puede llegar a producción).
 *
 *  /login, /signup y /portal/verify siguen en inglés a propósito de
 *  momento: son pantallas con acciones de servidor y redirecciones de
 *  autenticación, y moverlas bajo [locale] es un cambio con más riesgo que
 *  el de traducir páginas de contenido. Quedan como el siguiente paso, no
 *  como un olvido. */
function isNonLocalizedRoute(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/portal") ||
    // BUG FIX (found live, 2026-09-18, exact same regression class this
    // comment already warns about): the password-reset flow
    // (/forgot-password, /reset-password, /auth/confirm) lives directly
    // under src/app/, not src/app/[locale]/, same as /login -- missing
    // here meant next-intl rewrote it to /[locale]/forgot-password,
    // found no matching file, and 404'd. Caught by actually clicking
    // through the flow in the browser, not just reading the code.
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth") ||
    // Same reasoning, added proactively this time instead of found live:
    // /onboarding/organization lives directly under src/app/ too (the
    // post-Google-sign-in "create your fleet" step).
    pathname.startsWith("/onboarding") ||
    // REAL BUG FOUND LIVE (2026-09-23, exact same regression class this
    // comment already warns about, TWICE): send-driver-invite's email
    // has always linked to https://controlmiles.com/invite/<token>, and
    // this route was missing here -- every single driver invite ever
    // sent has 404'd on click, silently, since the feature shipped. The
    // page itself (src/app/invite/[token]/) was ALSO never built until
    // now; both halves of this bug had to be fixed for the flow to work.
    pathname.startsWith("/invite") ||
    // Driving-school student/parent portal (link with a token, no account).
    pathname.startsWith("/student/") ||
    // Driving-school client portal (2026-10-22): adult students and parents
    // of minors, signed in by an email link; not fleet staff, no /login.
    pathname.startsWith("/lessons") ||
    // Driving school public booking page (2026-10-20).
    pathname.startsWith("/book/")
  );
}

// A driving school's public booking page may be shown in an iframe on the
// sites the school lists (Settings > Website, ds_public_origins); every
// other page keeps frame-ancestors 'none'. Cached a minute per slug.
const originCache = new Map<string, { at: number; value: string }>();
async function bookFrameAncestors(pathname: string): Promise<string | undefined> {
  const slug = /^\/book\/([a-z0-9-]{3,40})(?:\/|$)/.exec(pathname)?.[1];
  if (!slug) return undefined;
  const hit = originCache.get(slug);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  let value = "'self'";
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/ds_public_origins`, {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_slug: slug }),
      signal: AbortSignal.timeout(2000),
    });
    const origins = res.ok ? ((await res.json()) as string[] | null) : null;
    // The database only stores https origins (fn_valid_origins); re-checked here.
    const safe = (origins ?? []).filter((o) => /^https:\/\/[a-z0-9.-]+(:\d{2,5})?$/.test(o));
    if (safe.length) value = `'self' ${safe.join(" ")}`;
  } catch {
    // Fail closed: only our own pages may frame it.
  }
  originCache.set(slug, { at: Date.now(), value });
  return value;
}

// A driving school's own address (level 3, 2026-10-20): any host that isn't
// ControlMiles's shows only that school's enrollment page. The host -> page
// map comes from ds_public_slug_for_host (verified addresses only), cached a
// minute.
const MAIN_HOSTS = new Set(
  ["controlmiles.com", "www.controlmiles.com", "localhost", "127.0.0.1", ...(process.env.APP_HOSTS ?? "").split(",")]
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);
const hostCache = new Map<string, { at: number; slug: string | null }>();
async function schoolSlugForHost(host: string): Promise<string | null> {
  const hit = hostCache.get(host);
  if (hit && Date.now() - hit.at < 60_000) return hit.slug;
  let slug: string | null = null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/ds_public_slug_for_host`, {
      method: "POST",
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ p_host: host }),
      signal: AbortSignal.timeout(2000),
    });
    const value = res.ok ? ((await res.json()) as string | null) : null;
    slug = typeof value === "string" && /^[a-z0-9-]{3,40}$/.test(value) ? value : null;
  } catch {
    slug = null;
  }
  hostCache.set(host, { at: Date.now(), slug });
  return slug;
}

export async function proxy(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  if (host && !MAIN_HOSTS.has(host) && !host.endsWith(".vercel.app")) {
    const slug = await schoolSlugForHost(host);
    if (!slug) return new NextResponse("Not found", { status: 404 });
    const path = request.nextUrl.pathname;
    const page = `/book/${slug}`;
    if (path !== "/" && path !== page) return NextResponse.redirect(new URL("/", request.url));
    const target = new URL(`${page}${request.nextUrl.search}`, request.url);
    return updateSession(request, await bookFrameAncestors(page), target);
  }

  if (isNonLocalizedRoute(request.nextUrl.pathname)) {
    return updateSession(request, await bookFrameAncestors(request.nextUrl.pathname));
  }

  const intlResponse = intlMiddleware(request);

  // next-intl responde con un redirect (p. ej. detección de idioma): no hay
  // página que servir todavía, así que se devuelve tal cual y la sesión se
  // refrescará en la petición siguiente.
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  const sessionResponse = await updateSession(request);

  // updateSession puede decidir una redirección propia (ruta protegida sin
  // sesión). Esa gana siempre: la autorización no se negocia con el idioma.
  if (sessionResponse.status >= 300 && sessionResponse.status < 400) {
    return sessionResponse;
  }

  // Caso normal: se conserva la reescritura de idioma y se le trasplantan
  // las cookies refrescadas y la cabecera de seguridad que produjo Supabase
  // (CSP con su nonce por request).
  for (const cookie of sessionResponse.cookies.getAll()) {
    intlResponse.cookies.set(cookie);
  }
  const csp = sessionResponse.headers.get("Content-Security-Policy");
  if (csp) intlResponse.headers.set("Content-Security-Policy", csp);

  return intlResponse;
}

export const config = {
  matcher: [
    // .well-known/ and robots/sitemap: static files served from public/.
    // cm-book.js: the driving school embed script (public/, 2026-10-20).
    // REAL BUG (2026-09-29): /.well-known/assetlinks.json went through
    // next-intl, got rewritten to /[locale]/.well-known/... and 404'd in
    // production, so Android never verified the /invite App Link.
    // api/trip-map/: public, token-checked route images; skipping the
    // session refresh keeps Set-Cookie off them so the CDN can cache them.
    "/((?!_next/static|_next/image|favicon.ico|\\.well-known/|api/trip-map/|robots\\.txt|sitemap\\.xml|cm-book\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
