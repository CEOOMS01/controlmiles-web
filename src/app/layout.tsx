import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
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
  title: "ControlMiles — Mileage tracking for gig drivers & fleets",
  description:
    "GPS trip tracking, odometer verification, and automatic gig-app detection for gig drivers and the fleets managing them.",
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

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
