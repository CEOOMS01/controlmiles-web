"use client";

// Per-trip route map for the Report Portal (explicit user request,
// 2026-09-20): "que se vea... el dibujo del viaje... desde punto A...
// hasta... punto B, y esta imagen... vivirá solo en el reporte web".
// Mirrors admin/fleet-map.tsx's own dynamic-import pattern exactly --
// Leaflet touches `window` at import time, so the whole map has to be
// client-only, dynamic-imported with ssr:false rather than just
// "use client" alone (which still gets pre-rendered on the server once).

import dynamic from "next/dynamic";
import type { PortalRoute } from "./report-data";

const RouteMapInner = dynamic(() => import("./route-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
      Loading map…
    </div>
  ),
});

export function RouteMap({ route }: { route: PortalRoute }) {
  return (
    <div className="h-56 overflow-hidden rounded-lg">
      <RouteMapInner points={route.points} />
    </div>
  );
}
