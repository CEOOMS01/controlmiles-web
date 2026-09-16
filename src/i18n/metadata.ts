// Olympus Mont Systems LLC - ControlMiles
// src/i18n/metadata.ts
//
// hreflang para las páginas traducidas.
//
// Sin esto, Google ve /pricing y /es/pricing como dos páginas distintas que
// dicen lo mismo y tiene que adivinar cuál mostrar a quién -- en el peor
// caso las trata como contenido duplicado. `alternates.languages` le dice
// explícitamente que son la misma página en dos idiomas, y `x-default`
// cuál servir a quien no encaje en ninguno.

import { routing } from "./routing";

const SITE = "https://controlmiles.com";

/** @param path ruta SIN prefijo de idioma, p. ej. "/pricing" o "" */
export function alternatesFor(path: string, locale: string) {
  const clean = path === "/" ? "" : path;
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = l === routing.defaultLocale ? `${SITE}${clean}` : `${SITE}/${l}${clean}`;
  }
  return {
    canonical:
      locale === routing.defaultLocale ? `${SITE}${clean}` : `${SITE}/${locale}${clean}`,
    languages: { ...languages, "x-default": `${SITE}${clean}` },
  };
}
