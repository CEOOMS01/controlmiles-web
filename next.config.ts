import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Le indica a next-intl dónde vive la configuración por request.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Static security headers (checklist 18/19). Content-Security-Policy is
// deliberately NOT here -- it needs a fresh nonce per request to allow
// Next.js's own inline hydration scripts without `'unsafe-inline'`, so
// it's set dynamically in src/lib/supabase/middleware.ts instead.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Everything but the driving school booking pages.
        source: "/:path((?!book/).*)",
        headers: securityHeaders,
      },
      {
        // /book/<slug> may be embedded on the school's own site: no
        // X-Frame-Options; the CSP frame-ancestors set in proxy.ts lists the
        // allowed sites (2026-10-20).
        source: "/book/:path*",
        headers: securityHeaders.filter((h) => h.key !== "X-Frame-Options"),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
