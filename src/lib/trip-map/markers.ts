// The start and end icons of every trip map (2026-11-09, the owner's design):
// a blue arrow tile where the trip starts, a gold tile with a brown disc where
// it arrives. Drawn on a 24x24 grid. The app's trip card uses the same drawing
// (controlmiles/assets/images/marker_start.svg and marker_end.svg).
//
// Solid shapes and one gradient only, so flutter_svg draws them as a browser does.

export const START_MARKER =
  `<rect x="0.75" y="0.75" width="22.5" height="22.5" rx="5.5" fill="#4569C4" stroke="#1F4FAE" stroke-width="1.5"/>` +
  `<path d="M20.1 3.4L3.35 10.2L11.3 12.6L13.8 20.6Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>` +
  `<path d="M20.1 3.4L3.35 10.2L14.5 9.3Z" fill="#2B59D9"/>` +
  `<path d="M3.35 10.2L11.3 12.6L14.5 9.3Z" fill="#1B2F96"/>` +
  `<path d="M11.3 12.6L13.8 20.6L14.5 9.3Z" fill="#12207A"/>` +
  `<path d="M14.5 9.3L13.8 20.6L20.1 3.4Z" fill="#1A4BB8"/>`;

export const END_MARKER =
  `<defs><linearGradient id="cmEndDisc" x1="0" y1="0" x2="1" y2="1">` +
  `<stop offset="0" stop-color="#A06F0E"/><stop offset="1" stop-color="#6B4503"/>` +
  `</linearGradient></defs>` +
  `<rect x="0.75" y="0.75" width="22.5" height="22.5" rx="5.5" fill="#F9BF55" stroke="#E3A532" stroke-width="1.5"/>` +
  `<circle cx="12" cy="12" r="8.8" fill="url(#cmEndDisc)" stroke="#FFFFFF" stroke-width="1"/>`;

/** One marker as markup for an <svg>, centred on (x, y). */
export function placeMarker(marker: string, x: number, y: number, size: number): string {
  const s = Math.round((size / 24) * 1000) / 1000;
  const at = (n: number) => Math.round((n - size / 2) * 10) / 10;
  return `<g transform="translate(${at(x)} ${at(y)}) scale(${s})">${marker}</g>`;
}
