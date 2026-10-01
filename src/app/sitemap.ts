import type { MetadataRoute } from "next";

const BASE = "https://controlmiles.com";
const PAGES = ["", "/pricing", "/fleet/enterprise-brief", "/privacy", "/privacy/fleet", "/terms", "/terms/fleet", "/delete-account"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({
    url: `${BASE}${path}`,
    alternates: { languages: { en: `${BASE}${path}`, es: `${BASE}/es${path}` } },
  }));
}
