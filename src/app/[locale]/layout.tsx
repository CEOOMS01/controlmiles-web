// Olympus Mont Systems LLC - ControlMiles
// src/app/[locale]/layout.tsx
//
// Capa de idioma para las páginas públicas. Deliberadamente NO renderiza
// <html>/<body>: eso vive en el layout raíz, que es el único que puede
// declararlo (ver su comentario sobre por qué `lang` se resuelve allí).
// Este layout solo aporta el proveedor de mensajes y valida el idioma.

import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

// Permite que estas páginas se generen estáticamente por idioma en vez de
// renderizarse por request.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Un idioma que no existe da 404 en vez de renderizar la página con el
  // idioma por defecto: servir contenido en /fr/pricing con un 200 sería
  // decirle a Google que esa URL es válida.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}
