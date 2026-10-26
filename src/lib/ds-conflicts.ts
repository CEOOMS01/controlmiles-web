// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/ds-conflicts.ts
//
// The codes the database raises when a class cannot be added or moved
// (fn_ds_conflict, ds_office_add_block, ds_office_move_block), as sentences.

import { AppError } from "@/lib/errors";

export function conflictMessage(raw: string | undefined): string {
  const m = raw ?? "";
  if (m.includes("BLOCKED:")) {
    const label = m.split("BLOCKED:")[1]?.trim().split("\n")[0];
    return label ? `That time is blocked (${label}).` : "That time is blocked.";
  }
  if (m.includes("TIME_OFF")) return "That instructor is off that day.";
  if (m.includes("INSTRUCTOR_BUSY")) return "That instructor already has a class at that time.";
  if (m.includes("CAR_BUSY")) return "That car is already in use at that time.";
  if (m.includes("NOT_MOVABLE")) return "Only a scheduled class can be moved.";
  if (m.includes("BAD_TIME")) return "The class must end the same day, after it starts.";
  if (m.includes("BAD_INSTRUCTOR")) return "Pick an active instructor.";
  if (m.includes("BAD_CAR")) return "Pick one of the school's cars.";
  if (m.includes("FORBIDDEN")) return AppError.featureNotInPlan.message;
  return "Could not save. Try again.";
}
