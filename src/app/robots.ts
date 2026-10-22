import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /student and /book (2026-10-20): token pages and school enrollment pages.
      disallow: ["/admin", "/api", "/portal/generate", "/invite", "/onboarding", "/student", "/book", "/lessons"],
    },
    sitemap: "https://controlmiles.com/sitemap.xml",
  };
}
