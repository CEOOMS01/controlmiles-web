"use client";

// Olympus Mont Systems LLC - ControlMiles
// src/components/pageview-beacon.tsx
//
// Reports each page view to CGC Core's real-time analytics endpoint
// (2026-09-21, explicit user request: "cgc core me muestre las visitas a
// mi pagina en tiempo real"). Fires once per route change via
// usePathname() -- this is a client-side-navigated app (next/link), so a
// plain server-rendered <img> beacon or a middleware hook would miss every
// in-app navigation after the first load.
//
// Privacy: session_id lives in sessionStorage (cleared when the tab
// closes), never localStorage, never tied to an account/email, and is
// only ever sent to our own CGC Core instance -- no third-party analytics
// vendor, consistent with the privacy policy's existing "we do not
// currently use third-party advertising networks" line.

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const CGC_CORE_URL = "https://cgc-cre.vercel.app";
const SESSION_KEY = "cm_analytics_session_id";

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // Private-window/blocked-storage fallback -- a per-call random id
    // just means this visit won't dedupe into the same "session" as this
    // visitor's other pageviews; the beacon itself still works.
    return crypto.randomUUID();
  }
}

export function PageviewBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    const sessionId = getSessionId();
    fetch(`${CGC_CORE_URL}/analytics/pageview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site: "controlmiles.com",
        path: pathname,
        session_id: sessionId,
        referrer: document.referrer || undefined,
      }),
      keepalive: true,
    }).catch(() => {
      // Best-effort, same convention as every other beacon in this
      // ecosystem -- a failed analytics ping must never surface to the
      // visitor or break navigation.
    });
  }, [pathname]);

  return null;
}
