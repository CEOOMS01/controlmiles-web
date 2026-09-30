"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import "./auth-road.css";

// Road + logo intro for the sign-in / sign-up brand panel (see
// auth-road.css for the design and timing). The CSS plays it once per page
// load on its own; this only marks it as seen for the session, so moving
// between Sign in and Create account (or back) shows the finished road
// instead of replaying it.
const SEEN_KEY = "cm-auth-intro-seen";
const ROAD_D = "M -10 190 C 90 190, 110 70, 210 70 S 340 190, 420 140 S 520 50, 610 80";

export function AuthBrandIntro() {
  const [state, setState] = useState<"play" | "done">("play");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Storage blocked (private mode): the intro simply plays again.
    }
    // Reading sessionStorage is only possible after mount; this is the
    // one-time sync with that external store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (seen) setState("done");
  }, []);

  return (
    <div data-auth-intro={state} className="contents">
      <svg
        viewBox="0 0 600 220"
        className="pointer-events-none absolute top-[24%] left-0 w-full"
        aria-hidden="true"
      >
        <g className="auth-road-surface">
          <path d={ROAD_D} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="16" strokeLinecap="round" />
          <path d={ROAD_D} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" strokeDasharray="8 10" />
        </g>
        <path className="auth-road-lit" d={ROAD_D} fill="none" stroke="#9cc9ea" strokeWidth="3" strokeLinecap="round" />
        <g className="auth-road-car">
          <g className="auth-road-car-bob">
            <rect x="-13" y="-7" width="26" height="14" rx="6" fill="#ffffff" />
            <rect x="2" y="-5" width="8" height="10" rx="2" fill="#1f5f8b" />
          </g>
        </g>
      </svg>

      <div className="relative flex items-center gap-3">
        <span className="relative inline-flex">
          <span className="auth-brand-glow absolute inset-0 rounded-lg bg-[#9cc9ea]" aria-hidden="true" />
          <Image
            src="/logo_controlmiles.png"
            alt=""
            width={40}
            height={40}
            className="auth-brand-logo relative rounded-lg"
            priority
          />
        </span>
        <span className="text-lg font-semibold tracking-tight">ControlMiles</span>
      </div>
    </div>
  );
}
