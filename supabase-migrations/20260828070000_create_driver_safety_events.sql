-- ControlMiles Fleet -- driver safety events (harsh braking / hard
-- acceleration / speeding), detected client-side in the ControlMiles
-- mobile app (lib/tracking/driver_safety_monitor.dart) from GPS ticks
-- already flowing through the Fleet-only tracking path. Surfaced on this
-- admin dashboard at src/app/admin/safety/.
--
-- Mirrors this session's exact same migration applied to the shared
-- Supabase project from the controlmiles (Flutter) repo -- kept here too
-- so this repo's own migration history stays complete.

CREATE TABLE IF NOT EXISTS public.driver_safety_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid,
  section_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('harsh_braking', 'hard_acceleration', 'speeding')),
  speed_mps double precision,
  latitude double precision,
  longitude double precision,
  recorded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_safety_events_org_recorded
  ON public.driver_safety_events(organization_id, recorded_at DESC);

ALTER TABLE public.driver_safety_events ENABLE ROW LEVEL SECURITY;

-- Same shape as session_gps_breadcrumbs_insert (the mobile app's own
-- Fleet-only write, same auth.uid() + org-membership guard).
DROP POLICY IF EXISTS driver_safety_events_insert ON public.driver_safety_events;
CREATE POLICY driver_safety_events_insert ON public.driver_safety_events
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_org_member(organization_id));

-- Deliberately admin-only (not is_org_member like breadcrumbs) -- this is
-- behavior/performance data about a specific driver, more sensitive than
-- a location ping. A driver shouldn't see a peer's harsh-braking record;
-- this admin dashboard is the only real consumer.
DROP POLICY IF EXISTS driver_safety_events_select ON public.driver_safety_events;
CREATE POLICY driver_safety_events_select ON public.driver_safety_events
  FOR SELECT USING (is_org_admin_or_owner(organization_id));
