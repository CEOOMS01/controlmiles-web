// MapLibre GL JS 6 ships its web worker as a separate file. Bundlers (Turbopack)
// do not place it correctly, so the map's tiles never drew. We serve it
// ourselves from public/maplibre/ and tell MapLibre where it is (src/lib/map-base.ts).
// Runs before dev and build so the copy always matches the installed version.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/maplibre", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre/maplibre-gl-worker.mjs");
