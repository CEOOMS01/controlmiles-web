export type PortalVehicle = {
  nickname: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
};

export type PortalGigAppBreakdown = {
  gig_app: string;
  irs_purpose: string | null;
  miles: number;
};

export type PortalWeeklyCheckpoint = {
  vehicle: PortalVehicle | null;
  week_start_date: string;
  week_end_date: string;
  start_odometer_value: number | null;
  start_odometer_photo_url: string | null;
  end_odometer_value: number | null;
  end_odometer_photo_url: string | null;
};

export type PortalRoutePoint = {
  lat: number;
  lng: number;
};

// One entry per trip (session) in the report's date range, per point A
// (trip start) to point B (trip end) live route drawing (explicit user
// request, 2026-09-20). `points` is either the real driven path (from
// session_gps_breadcrumbs, now recorded for every trip) or a 2-point
// straight-line fallback (session_sections' start/end lat-lng) for trips
// recorded before this feature existed -- see
// generate_report_access_code's own comment in
// 20260920100000_report_portal_route_points.sql. Only sessions with 2+
// points are included at all (nothing to draw with fewer).
export type PortalRoute = {
  session_id: string;
  date_key: string;
  total_miles: number;
  points: PortalRoutePoint[];
};

// One row per trip (session) in the report's date range -- mirrors the
// app's own PDF report (ReportService._buildGlobalTripsTableOnly): date,
// gig app(s) with IRS purpose, distance, duration, odometer start/end.
// Absent on a report generated before this field existed (old rows in
// `reports.metadata` predate it) -- callers default to an empty array.
export type PortalTrip = {
  date_key: string;
  apps_label: string;
  total_miles: number;
  duration_seconds: number;
  start_odometer_value: number | null;
  end_odometer_value: number | null;
};

export type PortalReport = {
  driver_display_name: string | null;
  driver_display_id: string | null;
  start_date: string;
  end_date: string;
  generated_at: string;
  total_miles: number;
  total_sessions: number;
  total_deduction_estimate: number;
  vehicles: PortalVehicle[];
  gig_app_breakdown: PortalGigAppBreakdown[];
  trips: PortalTrip[];
  weekly_checkpoints: PortalWeeklyCheckpoint[];
  route_points: PortalRoute[];
};
