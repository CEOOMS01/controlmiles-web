// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/service-profile.ts
//
// Each service (the "fleet type" an owner picks once) has its own words, its own menu group and its own
// dashboard, so a driving school, a school-bus company and a trucking fleet do not look like the same product
// (2026-11-16). What a service INCLUDES is still decided by the database (fn_org_features); this file is only
// how it is called and what its dashboard puts first.

import type { FleetProfile } from "./fleet-profiles";

export type KpiKey =
  | "people"
  | "vehicles"
  | "pending"
  | "review"
  | "safety"
  | "miles30"
  | "tripsToday"
  | "onRoad"
  | "geofence7"
  | "fuelOpen"
  | "approvals"
  | "ifta";

export type ServiceProfile = {
  /** "your fleet" / "your school" / "your company": settings and help texts. */
  orgNoun: string;
  /** What the people who drive are called, singular and plural. */
  person: string;
  people: string;
  /** What the vehicles are called. */
  vehicle: string;
  vehicles: string;
  /** Menu: the label of the team page and the title of the group with fuel, maintenance and reviews. */
  teamNav: string;
  groupTitle: string;
  maintenanceNav: string;
  reviewsNav: string;
  /** Team page subtitle. */
  teamHelp: string;
  /** Dashboard. */
  dashboardTitle: string;
  dashboardHelp: string;
  /** Cards, in order. "people", "vehicles" etc. take their label from the words above. */
  kpis: KpiKey[];
};

const FLEET: ServiceProfile = {
  orgNoun: "fleet",
  person: "Driver",
  people: "Drivers",
  vehicle: "Vehicle",
  vehicles: "Vehicles",
  teamNav: "Team",
  groupTitle: "Fleet",
  maintenanceNav: "Maintenance",
  reviewsNav: "Reviews",
  teamHelp: "Drivers, their vehicles and their access.",
  dashboardTitle: "Fleet dashboard",
  dashboardHelp: "Your drivers, vehicles and what needs a look.",
  kpis: ["people", "vehicles", "pending", "review", "safety"],
};

const PROFILES: Record<FleetProfile, ServiceProfile> = {
  general: FLEET,
  trucking: {
    ...FLEET,
    vehicle: "Truck",
    vehicles: "Trucks",
    groupTitle: "Trucks",
    maintenanceNav: "Truck maintenance",
    reviewsNav: "Inspections",
    teamHelp: "Drivers, their trucks and their access. Owner-operators too.",
    dashboardTitle: "Trucking dashboard",
    dashboardHelp: "Miles, fuel and the next IFTA filing at a glance.",
    kpis: ["people", "vehicles", "miles30", "ifta", "fuelOpen", "review", "safety"],
  },
  construction: {
    ...FLEET,
    vehicle: "Vehicle",
    vehicles: "Pickups & trucks",
    groupTitle: "Vehicles",
    reviewsNav: "Inspections",
    teamHelp: "Crews, their vehicles and their access.",
    person: "Crew member",
    people: "Crew",
    dashboardTitle: "Construction dashboard",
    dashboardHelp: "Who is on the road between job sites, and the miles they add up.",
    kpis: ["people", "vehicles", "onRoad", "miles30", "geofence7", "review"],
  },
  delivery: {
    ...FLEET,
    person: "Courier",
    people: "Couriers",
    vehicle: "Vehicle",
    vehicles: "Vehicles",
    reviewsNav: "Inspections",
    teamHelp: "Couriers, their vehicles and their access.",
    dashboardTitle: "Delivery dashboard",
    dashboardHelp: "Who is out delivering today and how far they have gone.",
    kpis: ["people", "onRoad", "tripsToday", "miles30", "geofence7", "review"],
  },
  field_service: {
    ...FLEET,
    person: "Technician",
    people: "Technicians",
    vehicle: "Van",
    vehicles: "Vans & trucks",
    groupTitle: "Vans & trucks",
    maintenanceNav: "Van maintenance",
    reviewsNav: "Inspections",
    teamHelp: "Technicians, their vans and their access.",
    dashboardTitle: "Field service dashboard",
    dashboardHelp: "Technicians on the road today and the miles per van.",
    kpis: ["people", "vehicles", "onRoad", "tripsToday", "miles30", "geofence7"],
  },
  passenger: {
    ...FLEET,
    vehicle: "Vehicle",
    vehicles: "Vehicles",
    teamHelp: "Drivers, their vehicles and their access.",
    reviewsNav: "Inspections",
    dashboardTitle: "Passenger transport dashboard",
    dashboardHelp: "Vehicles on a trip now, today's trips and safety checks.",
    kpis: ["people", "vehicles", "onRoad", "tripsToday", "review", "safety"],
  },
  school_transport: {
    ...FLEET,
    person: "Driver",
    people: "Drivers & aides",
    vehicle: "Bus",
    vehicles: "Buses",
    orgNoun: "school bus company",
    teamNav: "Drivers & aides",
    groupTitle: "Buses",
    maintenanceNav: "Bus maintenance",
    reviewsNav: "Bus inspections",
    teamHelp: "Bus drivers, aides and the buses they run.",
    dashboardTitle: "School bus dashboard",
    dashboardHelp: "Today's routes, who is running and what needs attention.",
    kpis: ["people", "vehicles", "onRoad", "tripsToday", "review", "safety"],
  },
  sales: {
    ...FLEET,
    orgNoun: "company",
    person: "Rep",
    people: "Reps",
    vehicle: "Company car",
    vehicles: "Company cars",
    teamNav: "Sales team",
    groupTitle: "Company cars",
    maintenanceNav: "Car maintenance",
    reviewsNav: "Reviews",
    teamHelp: "Sales reps, their company cars and their access.",
    dashboardTitle: "Sales dashboard",
    dashboardHelp: "Miles by rep and the trips waiting for your approval.",
    kpis: ["people", "vehicles", "miles30", "approvals", "tripsToday", "safety"],
  },
  driving_school: {
    ...FLEET,
    orgNoun: "school",
    person: "Instructor",
    // The team page lists everyone in the school (owner, admins, instructors), so the menu and the tab say "Team".
    people: "Team",
    vehicle: "Car",
    vehicles: "Cars",
    teamNav: "Team",
    groupTitle: "Cars",
    maintenanceNav: "Car maintenance",
    reviewsNav: "Car checks",
    teamHelp: "Instructors, the cars they teach in and their access.",
    dashboardTitle: "School dashboard",
    dashboardHelp: "Lessons, students and what needs attention.",
    kpis: ["people", "vehicles", "tripsToday", "review"],
  },
};

export function serviceProfile(template: string | null | undefined): ServiceProfile {
  return PROFILES[(template ?? "general") as FleetProfile] ?? FLEET;
}

/** IFTA returns are due on the last day of the month after each quarter: Apr 30, Jul 31, Oct 31, Jan 31. */
export function nextIftaDeadline(now: Date = new Date()): { quarter: string; due: Date; days: number } {
  const y = now.getUTCFullYear();
  const candidates = [
    { quarter: `Q4 ${y - 1}`, due: new Date(Date.UTC(y, 0, 31)) },
    { quarter: `Q1 ${y}`, due: new Date(Date.UTC(y, 3, 30)) },
    { quarter: `Q2 ${y}`, due: new Date(Date.UTC(y, 6, 31)) },
    { quarter: `Q3 ${y}`, due: new Date(Date.UTC(y, 9, 31)) },
    { quarter: `Q4 ${y}`, due: new Date(Date.UTC(y + 1, 0, 31)) },
  ];
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const next = candidates.find((c) => c.due.getTime() >= today) ?? candidates[candidates.length - 1];
  return { ...next, days: Math.round((next.due.getTime() - today) / 86_400_000) };
}
