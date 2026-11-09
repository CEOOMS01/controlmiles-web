// Trip route "photo" (2026-10-04, user request): a static SVG of the streets
// around a trip with its route drawn on top, one color per gig app. Built
// from our own basemap (the self-hosted .pmtiles on Cloudflare R2, same as
// the live maps) -- no third-party map service ever sees a route. The
// result is cached forever by the route handler once the trip is closed.
//
// Only what helps read a route is drawn: land, water, parks and roads
// (no buildings, labels or POIs), with coordinates rounded to 0.1 px, so a
// city trip stays in the tens of KB before gzip.

import { PMTiles } from "pmtiles";
import { VectorTile, type VectorTileFeature } from "@mapbox/vector-tile";
import Pbf from "pbf";
import type { LatLng } from "./polyline";
import { END_MARKER, START_MARKER, placeMarker } from "./markers";

// `muted`: drawn in gray for context and left out of the framing, legend
// and start/end markers (a single segment's image shows the rest of the
// trip this way).
export type RouteSegment = { gigApp: string; label: string; points: LatLng[]; muted?: boolean };

const WIDTH = 640;
const HEIGHT = 360;
const PADDING = 36;
const MARKER_SIZE = 30; // start and end icons; PADDING keeps them inside the frame
const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 16;

const COLORS = {
  background: "#e8e4dd",
  water: "#a8d8ea",
  park: "#cfe5c4",
  minor: "#ffffff",
  major: "#fdfcf8",
  majorCasing: "#d9d2c5",
  highway: "#fbe3a4",
  highwayCasing: "#d9b86a",
};

// One color per gig app, readable on the light basemap.
const GIG_COLORS: Record<string, string> = {
  uber: "#111827",
  uber_eats: "#06c167",
  lyft: "#ff00bf",
  doordash: "#eb1700",
  instacart: "#0aad0a",
  amazon: "#ff9900",
  roadie: "#2563eb",
  empower: "#7c3aed",
  custom: "#0f766e",
};
const FALLBACK_COLORS = ["#2563eb", "#db2777", "#ea580c", "#16a34a", "#9333ea", "#0891b2"];

export function gigColor(gigApp: string, index: number): string {
  return GIG_COLORS[gigApp] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

// --- Web Mercator, in pixels at zoom z ---
function project(lat: number, lng: number, z: number): [number, number] {
  const scale = TILE * 2 ** z;
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return [
    ((lng + 180) / 360) * scale,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  ];
}

const r = (n: number) => Math.round(n * 10) / 10;

let pmtilesInstance: PMTiles | null = null;
function basemap(): PMTiles {
  const url = process.env.NEXT_PUBLIC_FLEET_MAP_PMTILES_URL;
  if (!url) throw new Error("NEXT_PUBLIC_FLEET_MAP_PMTILES_URL is not configured");
  pmtilesInstance ??= new PMTiles(url);
  return pmtilesInstance;
}

type Layer = { d: string[] };

// Points closer than this to the last kept one are dropped: invisible at
// this size, and most of a tile's bytes (2026-10-04: a 33-mile trip went
// from 2 MB to tens of KB with this + the off-frame skip below).
const MIN_STEP_PX = 1.5;
const MARGIN = 8;
const CLIP = 24; // px kept beyond the frame so a road never ends short of its edge

// "Lite" drawing (2026-11-04, for the PDF report and the phone): the same
// picture with a coarser outline, no tiny roads and no tiny patches of park or
// water -- what a 640x360 thumbnail cannot show anyway. Cuts the file by a
// large factor, which matters when a report carries dozens of trips.
type Detail = { step: number; minPath: number; minArea: number };
const FULL: Detail = { step: 1, minPath: 0, minArea: 40 };
const LITE: Detail = { step: 3, minPath: 22, minArea: 160 };

function pathFromRings(
  rings: { x: number; y: number }[][],
  toPx: (x: number, y: number) => [number, number],
  closed: boolean,
  detail: Detail,
): string {
  // Filled areas (water, parks) tolerate a coarser outline than roads.
  const step = (closed ? MIN_STEP_PX * 2 : MIN_STEP_PX) * detail.step;
  let d = "";
  for (const ring of rings) {
    if (ring.length < 2) continue;
    const pts = ring.map((p) => toPx(p.x, p.y));

    // Skip rings entirely outside the frame.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    if (x1 < -MARGIN || y1 < -MARGIN || x0 > WIDTH + MARGIN || y0 > HEIGHT + MARGIN) continue;
    // Polygons smaller than a few pixels aren't worth drawing.
    if (closed && (x1 - x0) * (y1 - y0) < detail.minArea) continue;
    // Short stretches of road are not worth a line in the lite drawing.
    if (!closed && (x1 - x0) + (y1 - y0) < detail.minPath) continue;

    let part = "";
    let kept = 0;
    let lx = 0, ly = 0;
    // A road keeps only the stretch that can show in the frame (2026-11-04):
    // a long highway used to bring every vertex it has across the whole state
    // -- most of the file -- for the few pixels that are visible. A vertex is
    // kept when either segment touching it reaches the frame (plus a margin);
    // a dropped run restarts the line with "M" so nothing is drawn across it.
    const reaches = (a: [number, number], b: [number, number]) =>
      Math.max(a[0], b[0]) > -CLIP && Math.min(a[0], b[0]) < WIDTH + CLIP &&
      Math.max(a[1], b[1]) > -CLIP && Math.min(a[1], b[1]) < HEIGHT + CLIP;
    let gap = false;
    pts.forEach(([x, y], i) => {
      if (!closed) {
        const near =
          (i > 0 && reaches(pts[i - 1], pts[i])) ||
          (i < pts.length - 1 && reaches(pts[i], pts[i + 1]));
        if (!near) {
          gap = true;
          return;
        }
      }
      const isLast = i === pts.length - 1;
      if (!gap && i > 0 && !isLast && Math.abs(x - lx) < step && Math.abs(y - ly) < step) return;
      part += `${kept === 0 || gap ? "M" : "L"}${Math.round(x)} ${Math.round(y)}`;
      kept++;
      gap = false;
      lx = x;
      ly = y;
    });
    if (kept < 2) continue;
    d += part + (closed ? "Z" : "");
  }
  return d;
}

export async function renderTripMapSvg(
  segments: RouteSegment[],
  opts: { lite?: boolean } = {},
): Promise<string> {
  const level = opts.lite ? LITE : FULL;
  // Frame the focused segments only (all of them for a whole-trip image).
  const all = segments.filter((s) => !s.muted).flatMap((s) => s.points);
  if (all.length === 0) throw new Error("NO_ROUTE");

  const pm = basemap();
  const header = await pm.getHeader();
  const tileMaxZoom = header.maxZoom;

  // Largest zoom where the whole route fits inside the padded frame.
  let z = MAX_ZOOM;
  for (; z > MIN_ZOOM; z--) {
    const xs = all.map(([la, ln]) => project(la, ln, z)[0]);
    const ys = all.map(([la, ln]) => project(la, ln, z)[1]);
    if (Math.max(...xs) - Math.min(...xs) <= WIDTH - 2 * PADDING &&
        Math.max(...ys) - Math.min(...ys) <= HEIGHT - 2 * PADDING) break;
  }
  const projected = all.map(([la, ln]) => project(la, ln, z));
  const minX = Math.min(...projected.map((p) => p[0]));
  const maxX = Math.max(...projected.map((p) => p[0]));
  const minY = Math.min(...projected.map((p) => p[1]));
  const maxY = Math.max(...projected.map((p) => p[1]));
  const originX = (minX + maxX) / 2 - WIDTH / 2;
  const originY = (minY + maxY) / 2 - HEIGHT / 2;

  // Tiles: at most the basemap's max zoom, scaled up past it (overzoom).
  const tz = Math.min(z, tileMaxZoom);
  const factor = 2 ** (z - tz);
  const tilePx = TILE * factor;
  const n = 2 ** tz;
  const tx0 = Math.floor(originX / tilePx);
  const ty0 = Math.floor(originY / tilePx);
  const tx1 = Math.floor((originX + WIDTH) / tilePx);
  const ty1 = Math.floor((originY + HEIGHT) / tilePx);

  const layers: Record<string, Layer> = {
    water: { d: [] },
    park: { d: [] },
    minor: { d: [] },
    major: { d: [] },
    highway: { d: [] },
  };

  const jobs: Promise<void>[] = [];
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      if (ty < 0 || ty >= n) continue;
      const wrappedX = ((tx % n) + n) % n;
      jobs.push(
        pm.getZxy(tz, wrappedX, ty).then((tile) => {
          if (!tile?.data) return;
          const vt = new VectorTile(new Pbf(new Uint8Array(tile.data)));
          const toPx = (extent: number) => (x: number, y: number): [number, number] => [
            tx * tilePx + (x / extent) * tilePx - originX,
            ty * tilePx + (y / extent) * tilePx - originY,
          ];
          const each = (name: string, fn: (f: VectorTileFeature) => void) => {
            const layer = vt.layers[name];
            if (!layer) return;
            for (let i = 0; i < layer.length; i++) fn(layer.feature(i));
          };

          each("water", (f) => {
            if (f.type === 3) layers.water.d.push(pathFromRings(f.loadGeometry(), toPx(f.extent), true, level));
          });
          each("landuse", (f) => {
            const kind = String(f.properties.kind ?? "");
            if (f.type === 3 && ["park", "forest", "wood", "grass", "golf_course", "nature_reserve", "cemetery"].includes(kind)) {
              layers.park.d.push(pathFromRings(f.loadGeometry(), toPx(f.extent), true, level));
            }
          });
          each("roads", (f) => {
            if (f.type !== 2) return;
            const kind = String(f.properties.kind ?? "");
            const detail = String(f.properties.kind_detail ?? "");
            const target =
              kind === "highway" ? layers.highway
              : kind === "major_road"
                ? // Lite: only the roads that matter at this scale (trunk and
                  // primary always, secondary once the map is zoomed in).
                  opts.lite && !(["trunk", "primary"].includes(detail) || (detail === "secondary" && z >= 11))
                  ? null
                  : layers.major
              : kind === "minor_road" && detail !== "service" && z >= 12 ? layers.minor
              : null;
            if (target) target.d.push(pathFromRings(f.loadGeometry(), toPx(f.extent), false, level));
          });
        }).catch(() => {
          // A missing/failed tile just leaves that area blank; the route still draws.
        }),
      );
    }
  }
  await Promise.all(jobs);

  // Road widths grow with zoom, like the live map.
  const w = (base: number) => r(base * Math.max(0.6, Math.min(2.4, (z - 9) / 3)));

  const toD = (pts: LatLng[]) =>
    pts
      .map(([la, ln], j) => {
        const [x, y] = project(la, ln, z);
        return `${j === 0 ? "M" : "L"}${r(x - originX)} ${r(y - originY)}`;
      })
      .join("");
  const toXY = ([la, ln]: LatLng) => {
    const [x, y] = project(la, ln, z);
    return [x - originX, y - originY] as const;
  };

  // One color per gig app for the whole trip (the same app twice draws
  // alike, and matches its legend row); apps without a brand color take
  // palette colors in order of first appearance in the trip, so a segment
  // has the same color on the trip image and on its own image.
  const appOrder = [...new Set(segments.map((s) => s.gigApp))];
  const routePaths = segments
    .filter((s) => s.points.length > 0 && !s.muted)
    .map((s) => ({
      color: gigColor(s.gigApp, appOrder.indexOf(s.gigApp)),
      d: toD(s.points),
      label: s.label,
      points: s.points,
    }));
  const mutedPaths = segments.filter((s) => s.muted && s.points.length > 1).map((s) => toD(s.points));

  const first = routePaths[0].points[0];
  const lastPts = routePaths[routePaths.length - 1].points;
  const last = lastPts[lastPts.length - 1];
  let [sx, sy] = toXY(first);
  let [ex, ey] = toXY(last);
  // A round trip ends where it began: set the two icons side by side, or the
  // end icon would hide the start.
  if (Math.hypot(ex - sx, ey - sy) < MARKER_SIZE + 2) {
    const midX = (sx + ex) / 2;
    const midY = (sy + ey) / 2;
    [sx, sy] = [midX - (MARKER_SIZE + 2) / 2, midY];
    [ex, ey] = [midX + (MARKER_SIZE + 2) / 2, midY];
  }
  // Where the driver switched gig app: a dot in the new segment's color.
  const switchDots = routePaths.slice(1).map((p) => {
    const [x, y] = toXY(p.points[0]);
    return `<circle cx="${r(x)}" cy="${r(y)}" r="4.5" fill="${p.color}" stroke="#ffffff" stroke-width="2"/>`;
  }).join("");

  const legend = routePaths
    .filter((p, i, arr) => arr.findIndex((q) => q.label === p.label) === i)
    .map((p, i) =>
      // A white pill behind each label instead of a text halo
      // (paint-order isn't supported by flutter_svg, which the app uses).
      `<g transform="translate(8 ${HEIGHT - 26 - i * 20})"><rect x="0" y="0" width="${r(30 + p.label.length * 6.4)}" height="17" rx="8.5" fill="#ffffff" fill-opacity="0.9"/><rect x="7" y="6" width="14" height="5" rx="2" fill="${p.color}"/><text x="26" y="12.5" font-size="11" font-family="Arial,Helvetica,sans-serif" fill="#1f2937">${escapeXml(p.label)}</text></g>`)
    .join("");

  const join = (l: Layer) => l.d.join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="Trip route map">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.background}"/>` +
    `<path d="${join(layers.park)}" fill="${COLORS.park}"/>` +
    `<path d="${join(layers.water)}" fill="${COLORS.water}" fill-rule="evenodd"/>` +
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${join(layers.minor)}" stroke="${COLORS.minor}" stroke-width="${w(1.2)}"/>` +
    // Casing + fill reuse one path each (<use>), so road data is written once.
    `<defs><path id="mj" d="${join(layers.major)}"/><path id="hw" d="${join(layers.highway)}"/>` +
    routePaths.map((p, i) => `<path id="rt${i}" d="${p.d}"/>`).join("") + `</defs>` +
    `<use href="#mj" stroke="${COLORS.majorCasing}" stroke-width="${w(3.4)}"/>` +
    `<use href="#mj" stroke="${COLORS.major}" stroke-width="${w(2.4)}"/>` +
    `<use href="#hw" stroke="${COLORS.highwayCasing}" stroke-width="${w(4.4)}"/>` +
    `<use href="#hw" stroke="${COLORS.highway}" stroke-width="${w(3.2)}"/>` +
    mutedPaths.map((d) => `<path d="${d}" stroke="#9ca3af" stroke-width="3" stroke-opacity="0.8"/>`).join("") +
    routePaths.map((_, i) => `<use href="#rt${i}" stroke="#ffffff" stroke-width="7"/>`).join("") +
    routePaths.map((p, i) => `<use href="#rt${i}" stroke="${p.color}" stroke-width="4"/>`).join("") +
    `</g>` +
    switchDots +
    placeMarker(START_MARKER, sx, sy, MARKER_SIZE) +
    placeMarker(END_MARKER, ex, ey, MARKER_SIZE) +
    legend +
    `<rect x="${WIDTH - 136}" y="${HEIGHT - 17}" width="132" height="13" rx="3" fill="#ffffff" fill-opacity="0.85"/>` +
    `<text x="${WIDTH - 8}" y="${HEIGHT - 7.5}" text-anchor="end" font-size="9" font-family="Arial,Helvetica,sans-serif" fill="#4b5563">© OpenStreetMap contributors</text>` +
    `</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}
