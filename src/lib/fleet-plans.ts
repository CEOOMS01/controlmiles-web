// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/fleet-plans.ts
//
// The plan card shape shared by /pricing (Gig) and /fleet (generic fleet plans,
// built in src/lib/fleet-pricing.ts).

export type Plan = {
  name: string;
  price: string;
  unit: string;
  tagline: string;
  features: string[];
  cta: { label: string; href: string };
  /** One-time acquisition line shown under the price (fleet plans). */
  acquisition?: string;
  highlight?: boolean;
};
