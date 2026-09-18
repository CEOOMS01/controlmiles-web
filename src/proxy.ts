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

import { type NextRequest } from "next/server";
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
    pathname.startsWith("/auth")
  );
}

export async function proxy(request: NextRequest) {
  if (isNonLocalizedRoute(request.nextUrl.pathname)) {
    return updateSession(request);
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
