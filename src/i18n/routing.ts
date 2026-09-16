// Olympus Mont Systems LLC - ControlMiles
// src/i18n/routing.ts
//
// Configuración de rutas por idioma (2026-09-16, pedido explícito:
// "quiero integrar el idioma español").
//
// ALCANCE, decidido con el usuario: solo las páginas PÚBLICAS. El panel
// /admin se queda en inglés -- lo usan administradores de flota, es mucha
// más superficie y no aporta nada al SEO. Las rutas de /admin y /api ni
// siquiera pasan por el middleware de idioma (ver proxy.ts).
//
// localePrefix "as-needed" es lo que permite que ESTO NO ROMPA NADA de lo
// que ya está indexado: el inglés sigue viviendo en las mismas URLs de
// siempre (/pricing, /privacy), sin prefijo, y el español aparece bajo
// /es (/es/pricing). La alternativa ("always") habría movido cada URL
// existente a /en/... -- un cambio de estructura completo en un sitio ya
// desplegado y enlazado, a cambio de nada.

import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

// Envoltorios de Link/redirect/router que añaden el prefijo de idioma
// solos. Importar SIEMPRE estos en las páginas públicas en vez de
// next/link: un <Link href="/pricing"> crudo saca al usuario del español
// sin avisar, y es el error más fácil de cometer aquí.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
