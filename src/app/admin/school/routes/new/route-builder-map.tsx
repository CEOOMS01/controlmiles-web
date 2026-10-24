"use client";

// Client-only wrapper (MapLibre needs the browser), same dynamic-import
// pattern as the fleet map.

import dynamic from "next/dynamic";

const Inner = dynamic(() => import("./route-builder-map-inner"), {
  ssr: false,
  loading: () => <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl bg-background text-sm text-muted">Loading map…</div>,
});

export const RouteBuilderMap = Inner;
export type { MapStop } from "./route-builder-map-inner";
