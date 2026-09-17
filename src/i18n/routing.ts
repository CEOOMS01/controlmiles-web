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
  // BUG FIX (pedido explícito, 2026-09-17): next-intl trae activada por
  // defecto la negociación automática vía el header Accept-Language del
  // navegador -- un visitante de EE.UU. cuyo navegador/SO reporta español
  // como idioma (secundario o no) aterrizaba en /es en su primera visita
  // sin haberlo pedido nunca, confirmado en vivo por varios usuarios reales
  // en distintos estados. defaultLocale ya era "en", pero eso solo aplica
  // cuando la negociación no encuentra nada que hacer matching -- con
  // localeDetection activo, si HAY un match (aunque sea parcial/erróneo)
  // gana sobre el default. false apaga tanto esa negociación por header
  // como la lectura de la cookie de idioma en la primera visita: todo
  // visitante nuevo entra en inglés siempre, y solo pasa a español si elige
  // el switcher explícitamente (eso sigue funcionando igual -- no depende
  // de este flag).
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

// Envoltorios de Link/redirect/router que añaden el prefijo de idioma
// solos. Importar SIEMPRE estos en las páginas públicas en vez de
// next/link: un <Link href="/pricing"> crudo saca al usuario del español
// sin avisar, y es el error más fácil de cometer aquí.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
