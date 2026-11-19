import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { PageviewBeacon } from "@/components/pageview-beacon";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CM Fleet — Fleet and driving school management",
  description:
    "GPS trip tracking, odometer verification, schedules and payments for fleets, school buses and driving schools.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading the per-request nonce middleware set (src/lib/supabase/middleware.ts)
  // is what makes Next.js stamp that same nonce onto its own generated <script>
  // tags AND forces this route to render dynamically per-request instead of
  // being prerendered/cached -- without it, a cached page ships script tags
  // with a stale build-time nonce while the CSP header carries a fresh one on
  // every request, so every <script> fails the nonce check and the whole site
  // never hydrates (confirmed live: x-vercel-cache HIT pages had zero working
  // JS, every click silently did nothing).
  await headers();

  // El idioma se resuelve aquí, en la raíz, porque `lang` vive en <html> y
  // <html> no puede declararse dos veces (el segmento [locale] no puede
  // renderizar su propio documento sin anidar uno dentro de otro).
  // getLocale() funciona en cualquier Server Component, incluidas las rutas
  // NO traducidas como /admin: ahí devuelve el idioma por defecto.
  const locale = await getLocale();

  // The panel's day/night buttons were removed (2026-11-17): the theme follows the device.
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PageviewBeacon />
        {children}
      </body>
    </html>
  );
}
