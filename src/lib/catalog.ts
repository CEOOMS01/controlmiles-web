// Mirrors lib/models/gig_app.dart's GigAppCatalog/IrsPurposeCatalog in the
// Flutter app -- same ids, same display labels, so a report looks
// identical whether read on the phone or verified here. Kept as a
// second copy (different language/runtime) rather than a shared package,
// but the id sets must stay in sync if the Flutter catalog ever changes.

export const GIG_APP_LABELS: Record<string, string> = {
  uber: "Uber",
  lyft: "Lyft",
  empower: "Empower",
  amazon: "Amazon Flex",
  uber_eats: "Uber Eats",
  doordash: "DoorDash",
  instacart: "Instacart",
  roadie: "Roadie",
  custom: "Custom/Truck",
};

export const IRS_PURPOSE_LABELS: Record<string, string> = {
  business: "Business",
  work: "Work Commute",
  medical: "Medical",
  moving: "Moving",
  charitable: "Charitable",
  education: "Education",
  personal: "Personal",
};

export function gigAppLabel(id: string): string {
  return GIG_APP_LABELS[id] ?? id;
}

export function irsPurposeLabel(id: string | null): string | null {
  if (!id) return null;
  return IRS_PURPOSE_LABELS[id] ?? id;
}
