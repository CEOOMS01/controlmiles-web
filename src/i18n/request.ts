// Olympus Mont Systems LLC - ControlMiles
// src/i18n/request.ts
//
// Carga de mensajes en el servidor. Los diccionarios se resuelven aquí,
// dentro de un Server Component, así que el JSON del idioma NO viaja al
// bundle del cliente: el navegador recibe el texto ya renderizado. Ese es
// justamente el motivo de usar next-intl con App Router en vez de una
// librería pensada para cliente.

import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  // Un idioma desconocido en la URL (/fr/pricing escrito a mano, un bot,
  // un enlace roto) cae al idioma por defecto en vez de reventar la
  // página con un import que no existe.
  const locale: Locale = routing.locales.includes(requested as Locale)
    ? (requested as Locale)
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
