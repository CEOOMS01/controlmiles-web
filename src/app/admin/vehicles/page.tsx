import { redirect } from "next/navigation";

// Team+Vehicles unification (explicit user request, 2026-09-23): vehicle
// management moved into /admin/roster (each driver row now carries its
// own vehicle picker, unassigned vehicles list below it) -- redirects
// rather than a hard 404/removal, in case anything still links here.
export default function VehiclesPage() {
  redirect("/admin/roster");
}
