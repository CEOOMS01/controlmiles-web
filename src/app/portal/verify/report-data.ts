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
  weekly_checkpoints: PortalWeeklyCheckpoint[];
};
