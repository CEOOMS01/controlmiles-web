import Image from "next/image";
import "./auth-road.css";

// Road + logo intro for the sign-in / sign-up brand panel (see
// auth-road.css for the design and timing). Plays every time the page loads
// (user request, 2026-09-29: a single run per load, not a loop); CSS only,
// so it starts with the page and prefers-reduced-motion shows the finished
// road instead.
const ROAD_D = "M -10 190 C 90 190, 110 70, 210 70 S 340 190, 420 140 S 520 50, 610 80";

/** The logo in the panel's top-left corner; it arrives when the car does. */
export function AuthBrandLogo() {
  return (
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
      <span className="auth-brand-name text-lg font-semibold tracking-tight">
        <span className="auth-brand-name-sheen">ControlMiles</span>
      </span>
    </div>
  );
}

/** The road, placed above the headline (in the page flow, not behind it). */
export function AuthRoad({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 220" className={`pointer-events-none block ${className}`} aria-hidden="true">
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
  );
}
