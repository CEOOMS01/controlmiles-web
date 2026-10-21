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

// Security review (2026-10-20): the raw path leaked secrets to analytics --
// the student portal token (/student/<token>), driver invite tokens and
// record ids. Pages behind a link token, and a school's public enrollment
// pages (visitors are often minors; the page promises no analytics), send
// nothing; every other path has its ids and long tokens masked, and the
// referrer is reduced to its origin.
const SKIP = /^\/(student|invite|book|portal|reset-password|auth)(\/|$)/;
function safePath(path: string): string {
  return path
    .split("/")
    .map((part) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part) || /^[A-Za-z0-9_-]{20,}$/.test(part)
        ? ":id"
        : part,
    )
    .join("/");
}
function safeReferrer(ref: string): string | undefined {
  try {
    return ref ? new URL(ref).origin : undefined;
  } catch {
    return undefined;
  }
}
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
    if (!pathname || SKIP.test(pathname)) return;
    // A school's own address (custom domain) only ever shows its enrollment page.
    if (!/(^|\.)controlmiles\.com$|^localhost$|\.vercel\.app$/.test(window.location.hostname)) return;
    const sessionId = getSessionId();
    fetch(`${CGC_CORE_URL}/analytics/pageview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site: "controlmiles.com",
        path: safePath(pathname),
        session_id: sessionId,
        referrer: safeReferrer(document.referrer),
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
