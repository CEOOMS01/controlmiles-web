// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/ifta.ts
//
// The IFTA quarterly return math (explicit user request, 2026-09-30: "IFTA
// completo, según las reglas y como lo hizo la competencia"). Pure
// functions, no I/O, so the rules live in one place and can be checked by
// hand against a base jurisdiction's own worksheet. Rules as every base
// jurisdiction's return instructions state them (FLHSMV 85800, WV IFTA-13,
// AZ 99-0110):
//   - one return section per fuel type;
//   - miles and gallons are whole numbers;
//   - fleet MPG = total miles in ALL jurisdictions (non-IFTA AK/HI/DC
//     included) / total gallons, rounded to 2 decimals;
//   - taxable gallons = taxable miles / MPG, rounded to a whole gallon;
//   - net taxable gallons = taxable gallons - tax-paid gallons bought
//     there (negative = a credit);
//   - tax = net taxable gallons x the quarter's rate;
//   - surcharge (IN/KY/VA) = taxable gallons x surcharge rate, no tax-paid
//     deduction, never a credit.
// Same jurisdiction-summary shape as Samsara's / Motive's IFTA reports:
// miles -> taxable gallons -> tax-paid gallons -> net tax per state.

export type IftaFuel = "diesel" | "gasoline";

/** Our fuel name -> the IFTA tax matrix column. */
export const MATRIX_FUEL: Record<IftaFuel, string> = {
  diesel: "special_diesel",
  gasoline: "gasoline",
};

export const FUEL_LABEL: Record<IftaFuel, string> = {
  diesel: "Diesel",
  gasoline: "Gasoline",
};

export type IftaVehicle = {
  id: string;
  label: string;
  ifta_qualified: boolean;
  ifta_fuel_type: IftaFuel;
};

export type VehicleStateMiles = { vehicle_id: string; state_code: string; miles: number };

export type IftaPurchase = {
  id: string;
  vehicle_id: string;
  purchase_date: string;
  state_code: string | null;
  gallons: number;
  fuel_type: IftaFuel;
  tax_paid: boolean;
  vendor_name: string | null;
  total_cost_usd: number | null;
};

export type IftaRate = {
  jurisdiction_code: string;
  fuel_type: string;
  kind: "base" | "surcharge";
  rate_usd: number | null;
};

export type JurisdictionLine = {
  state: string;
  totalMiles: number;
  taxableMiles: number;
  taxableGallons: number;
  taxPaidGallons: number;
  netTaxableGallons: number;
  rate: number | null;
  tax: number;
  surchargeRate: number | null;
  surcharge: number;
  /** false for AK/HI/DC and anything else outside the IFTA matrix. */
  iftaMember: boolean;
};

export type FuelSection = {
  fuel: IftaFuel;
  totalMiles: number;
  totalGallons: number;
  mpg: number | null;
  lines: JurisdictionLine[];
  totalTax: number;
  totalSurcharge: number;
  netDue: number;
};

export type VehicleLine = {
  vehicle: IftaVehicle;
  miles: number;
  unattributedMiles: number;
  gallons: number;
  mpg: number | null;
};

export type IftaIssue = {
  severity: "error" | "warning";
  text: string;
};

export type IftaReturn = {
  quarter: string;
  sections: FuelSection[];
  vehicles: VehicleLine[];
  issues: IftaIssue[];
  ratesAvailable: boolean;
  netDue: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "2026-Q3" for a date. */
export function quarterOf(d: Date): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

/** First and last day (YYYY-MM-DD) of "2026-Q3". */
export function quarterRange(quarter: string): { start: string; end: string } {
  const [y, q] = quarter.split("-Q").map(Number);
  const start = new Date(Date.UTC(y, (q - 1) * 3, 1));
  const end = new Date(Date.UTC(y, q * 3, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

/** Returns are due the last day of the month after the quarter:
 *  Apr 30, Jul 31, Oct 31, Jan 31. */
export function quarterDueDate(quarter: string): string {
  const [y, q] = quarter.split("-Q").map(Number);
  return new Date(Date.UTC(y, q * 3 + 1, 0)).toISOString().slice(0, 10);
}

/** The last `count` quarters, newest first, starting with the current one. */
export function recentQuarters(now: Date, count: number): string[] {
  const out: string[] = [];
  let y = now.getFullYear();
  let q = Math.floor(now.getMonth() / 3) + 1;
  for (let i = 0; i < count; i++) {
    out.push(`${y}-Q${q}`);
    q -= 1;
    if (q === 0) {
      q = 4;
      y -= 1;
    }
  }
  return out;
}

// Class 8 trucks run ~5-8 MPG, box trucks and heavy pickups ~8-14. A fleet
// MPG far outside that almost always means missing receipts (too high) or
// missing GPS miles (too low) -- the first thing an IFTA auditor checks.
const MPG_PLAUSIBLE_MIN = 3;
const MPG_PLAUSIBLE_MAX = 15;

export function computeIftaReturn(input: {
  quarter: string;
  vehicles: IftaVehicle[];
  miles: VehicleStateMiles[];
  purchases: IftaPurchase[];
  rates: IftaRate[];
}): IftaReturn {
  const { quarter, vehicles, miles, purchases, rates } = input;
  const issues: IftaIssue[] = [];
  const qualified = vehicles.filter((v) => v.ifta_qualified);
  const qualifiedById = new Map(qualified.map((v) => [v.id, v]));
  const ratesAvailable = rates.length > 0;

  // Rates keyed by state + matrix fuel + kind.
  const rateKey = (state: string, fuel: string, kind: string) => `${state}|${fuel}|${kind}`;
  const rateMap = new Map<string, number | null>();
  const memberStates = new Set<string>();
  for (const r of rates) {
    rateMap.set(rateKey(r.jurisdiction_code, r.fuel_type, r.kind), r.rate_usd);
    if (r.kind === "base") memberStates.add(r.jurisdiction_code);
  }

  // Per-vehicle lines (drive the per-vehicle table and several checks).
  const vehicleLines: VehicleLine[] = qualified.map((v) => {
    const vm = miles.filter((m) => m.vehicle_id === v.id);
    const attributed = vm.filter((m) => m.state_code !== "UNKNOWN").reduce((s, m) => s + m.miles, 0);
    const unattributed = vm.filter((m) => m.state_code === "UNKNOWN").reduce((s, m) => s + m.miles, 0);
    const gallons = purchases.filter((p) => p.vehicle_id === v.id).reduce((s, p) => s + Number(p.gallons), 0);
    return {
      vehicle: v,
      miles: attributed,
      unattributedMiles: unattributed,
      gallons,
      mpg: gallons > 0 ? round2(attributed / gallons) : null,
    };
  });

  const sections: FuelSection[] = [];
  for (const fuel of ["diesel", "gasoline"] as IftaFuel[]) {
    const fleet = qualified.filter((v) => v.ifta_fuel_type === fuel);
    const fleetIds = new Set(fleet.map((v) => v.id));
    const fuelPurchases = purchases.filter((p) => fleetIds.has(p.vehicle_id) && p.fuel_type === fuel);
    if (fleet.length === 0 && fuelPurchases.length === 0) continue;

    // Whole miles per state, then the total as their sum (the return's
    // own column total).
    const stateMiles = new Map<string, number>();
    for (const m of miles) {
      if (!fleetIds.has(m.vehicle_id) || m.state_code === "UNKNOWN") continue;
      stateMiles.set(m.state_code, (stateMiles.get(m.state_code) ?? 0) + m.miles);
    }
    for (const [s, v] of stateMiles) stateMiles.set(s, Math.round(v));

    const taxPaid = new Map<string, number>();
    for (const p of fuelPurchases) {
      if (!p.state_code || !p.tax_paid) continue;
      taxPaid.set(p.state_code, (taxPaid.get(p.state_code) ?? 0) + Number(p.gallons));
    }
    for (const [s, v] of taxPaid) taxPaid.set(s, Math.round(v));

    const totalMiles = [...stateMiles.values()].reduce((s, v) => s + v, 0);
    const totalGallons = Math.round(fuelPurchases.reduce((s, p) => s + Number(p.gallons), 0));
    const mpg = totalGallons > 0 && totalMiles > 0 ? round2(totalMiles / totalGallons) : null;

    const matrixFuel = MATRIX_FUEL[fuel];
    const states = new Set([...stateMiles.keys(), ...taxPaid.keys()]);
    const lines: JurisdictionLine[] = [...states].sort().map((state) => {
      const member = memberStates.has(state);
      const total = stateMiles.get(state) ?? 0;
      const taxableMiles = member ? total : 0;
      const taxableGallons = mpg ? Math.round(taxableMiles / mpg) : 0;
      const paid = member ? (taxPaid.get(state) ?? 0) : 0;
      const net = taxableGallons - paid;
      const rate = member ? (rateMap.get(rateKey(state, matrixFuel, "base")) ?? null) : null;
      const surchargeRate = member ? (rateMap.get(rateKey(state, matrixFuel, "surcharge")) ?? null) : null;
      return {
        state,
        totalMiles: total,
        taxableMiles,
        taxableGallons,
        taxPaidGallons: paid,
        netTaxableGallons: net,
        rate,
        tax: rate != null ? round2(net * rate) : 0,
        surchargeRate,
        surcharge: surchargeRate != null ? round2(taxableGallons * surchargeRate) : 0,
        iftaMember: member,
      };
    });

    const totalTax = round2(lines.reduce((s, l) => s + l.tax, 0));
    const totalSurcharge = round2(lines.reduce((s, l) => s + l.surcharge, 0));
    sections.push({
      fuel,
      totalMiles,
      totalGallons,
      mpg,
      lines,
      totalTax,
      totalSurcharge,
      netDue: round2(totalTax + totalSurcharge),
    });

    const label = FUEL_LABEL[fuel];
    if (totalMiles > 0 && totalGallons === 0) {
      issues.push({
        severity: "error",
        text: `${label}: ${totalMiles.toLocaleString()} mi driven but no fuel receipts this quarter — the fleet MPG, and so the tax, can't be computed.`,
      });
    }
    if (totalGallons > 0 && totalMiles === 0) {
      issues.push({
        severity: "error",
        text: `${label}: fuel was bought but no GPS miles were recorded this quarter for these vehicles.`,
      });
    }
    if (mpg != null && (mpg < MPG_PLAUSIBLE_MIN || mpg > MPG_PLAUSIBLE_MAX)) {
      issues.push({
        severity: "warning",
        text: `${label} fleet MPG is ${mpg.toFixed(2)} — outside the usual ${MPG_PLAUSIBLE_MIN}–${MPG_PLAUSIBLE_MAX} range for IFTA vehicles. ${
          mpg > MPG_PLAUSIBLE_MAX ? "Receipts may be missing." : "GPS miles may be missing."
        } Auditors check this first.`,
      });
    }
  }

  if (!ratesAvailable) {
    issues.push({
      severity: "warning",
      text: `IFTA, Inc. hasn't published the ${quarter} tax rates yet (they're synced automatically when it does). Miles and gallons are final; the tax columns fill in then.`,
    });
  }

  const noState = purchases.filter((p) => qualifiedById.has(p.vehicle_id) && !p.state_code);
  if (noState.length > 0) {
    const g = noState.reduce((s, p) => s + Number(p.gallons), 0);
    issues.push({
      severity: "error",
      text: `${noState.length} fuel receipt${noState.length === 1 ? "" : "s"} (${g.toFixed(1)} gal) ${noState.length === 1 ? "has" : "have"} no state — no tax-paid credit is taken for ${noState.length === 1 ? "it" : "them"}. Set the state below.`,
    });
  }

  const wrongFuel = purchases.filter((p) => {
    const v = qualifiedById.get(p.vehicle_id);
    return v && v.ifta_fuel_type !== p.fuel_type;
  });
  if (wrongFuel.length > 0) {
    issues.push({
      severity: "warning",
      text: `${wrongFuel.length} fuel receipt${wrongFuel.length === 1 ? "" : "s"} ${wrongFuel.length === 1 ? "doesn't" : "don't"} match the vehicle's fuel type and ${wrongFuel.length === 1 ? "is" : "are"} left out. Fix the receipt or the vehicle's fuel type.`,
    });
  }

  const unattributed = vehicleLines.reduce((s, v) => s + v.unattributedMiles, 0);
  const attributed = vehicleLines.reduce((s, v) => s + v.miles, 0);
  if (unattributed >= 1) {
    issues.push({
      severity: "warning",
      text: `${Math.round(unattributed).toLocaleString()} mi (${((unattributed / (attributed + unattributed)) * 100).toFixed(1)}%) couldn't be matched to a state (outside the US or a GPS gap) and are left out. Check those trips before filing.`,
    });
  }

  for (const v of vehicleLines) {
    if (v.miles >= 50 && v.gallons === 0) {
      issues.push({
        severity: "warning",
        text: `${v.vehicle.label}: ${Math.round(v.miles).toLocaleString()} mi but no fuel receipts this quarter.`,
      });
    }
  }

  return {
    quarter,
    sections,
    vehicles: vehicleLines,
    issues,
    ratesAvailable,
    netDue: round2(sections.reduce((s, x) => s + x.netDue, 0)),
  };
}
