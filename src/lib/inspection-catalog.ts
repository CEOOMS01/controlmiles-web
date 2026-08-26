// Mirrors lib/models/vehicle_inspection.dart's InspectionCategory.all in
// the Flutter app -- same category ids, so a defect list reads
// identically whether viewed on the phone or reviewed here.
export const INSPECTION_CATEGORY_LABELS: Record<string, string> = {
  tires_wheels: "Tires & wheels",
  brakes: "Brakes",
  lights_signals: "Lights & signals",
  mirrors: "Mirrors",
  windshield_wipers: "Windshield & wipers",
  horn: "Horn",
  steering: "Steering",
  fluid_leaks: "Fluid leaks",
  seatbelts: "Seatbelts",
  body_damage: "Body damage",
  other: "Other",
};

export function inspectionCategoryLabel(id: string): string {
  return INSPECTION_CATEGORY_LABELS[id] ?? id;
}

export const INCIDENT_CATEGORY_LABELS: Record<string, string> = {
  breakdown: "Vehicle breakdown",
  accident: "Accident",
  delay: "Delay",
  other: "Other",
};

export function incidentCategoryLabel(id: string): string {
  return INCIDENT_CATEGORY_LABELS[id] ?? id;
}
