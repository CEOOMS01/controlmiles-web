-- Live trip-route drawing (explicit user request, 2026-09-20): "que se
-- vea en vivo el dibujo del viaje... y esta imagen de punto A to punto B
-- vivirá solo en el reporte web". Confirmed with the user: this lives in
-- the EXISTING Report Portal (this function's own metadata jsonb), not a
-- new screen -- same access-code-protected snapshot every other section
-- of the report already uses.
--
-- Builds on top of 20260918100000 (backfilled the same day as this
-- migration -- see that file's own header for why it didn't already
-- exist on disk). Same 5-arg signature, CREATE OR REPLACE in place, no
-- new overload -- only adding an output field (route_points) to the
-- returned metadata, not a parameter.
--
-- Route geometry source, per session in range:
--   1. session_gps_breadcrumbs, ordered by recorded_at -- the real
--      driven path, now recorded for every trip (Gig included, see
--      controlmiles's own 20260920100000_gps_breadcrumbs_allow_gig.sql
--      + the new ingest-gps-breadcrumb edge function). This is what
--      "el dibujo del viaje" means literally.
--   2. Fallback to session_sections' start/end lat-lng (stitched across
--      sections in time order) when a session has zero breadcrumbs --
--      covers every trip recorded before this feature existed, and any
--      trip where GPS never got a fix during travel but did at least
--      once at start/end. Still just a straight line in that case, not
--      the real path, but strictly better than nothing.
-- Sessions with fewer than 2 usable points are dropped entirely --
-- nothing to draw a line with.
create or replace function public.generate_report_access_code(
  p_start_date date,
  p_end_date date,
  p_vehicle_id uuid default null,
  p_weekly_checkpoints jsonb default '[]'::jsonb,
  p_target_user_id uuid default null
)
returns table(code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller uuid := auth.uid();
  v_user_id uuid;
  v_organization_id uuid;
  v_recent_count int;
  v_plain_code text;
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_expires timestamptz := now() + interval '15 minutes';
  v_metadata jsonb;
  v_deduction numeric;
  i int;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  if p_target_user_id is null or p_target_user_id = v_caller then
    v_user_id := v_caller;
  else
    select caller_m.organization_id into v_organization_id
    from public.organization_members caller_m
    join public.organization_members target_m
      on target_m.organization_id = caller_m.organization_id
    where caller_m.user_id = v_caller
      and caller_m.member_role in ('owner', 'admin')
      and caller_m.is_active = true
      and target_m.user_id = p_target_user_id
      and target_m.is_active = true
    limit 1;

    if v_organization_id is null then
      raise exception 'Not authorized to generate a report for that driver';
    end if;

    if public.fn_org_effective_tier(v_organization_id) = 'none' then
      raise exception 'FLEET_SUBSCRIPTION_REQUIRED';
    end if;

    v_user_id := p_target_user_id;
  end if;

  if p_end_date < p_start_date then
    raise exception 'Invalid date range';
  end if;

  select count(*) into v_recent_count
  from public.reports
  where generated_by = v_caller
    and generated_at > now() - interval '1 hour';

  if v_recent_count >= 5 then
    raise exception 'Too many report codes generated recently. Try again later.';
  end if;

  select coalesce(sum(
    case when s.date_key < date '2026-07-01'
      then s.total_miles * 72.5 / 100.0
      else s.total_miles * 76.0 / 100.0
    end
  ), 0) into v_deduction
  from public.sessions s
  where s.user_id = v_user_id
    and s.date_key between p_start_date and p_end_date
    and (p_vehicle_id is null or s.vehicle_id = p_vehicle_id);

  with vehicles_in_range as (
    select distinct v.id, v.nickname, v.make, v.model, v.year, v.plate
    from public.sessions s
    join public.vehicles v on v.id = s.vehicle_id
    where s.user_id = v_user_id
      and s.date_key between p_start_date and p_end_date
      and (p_vehicle_id is null or s.vehicle_id = p_vehicle_id)
  ),
  purpose_breakdown as (
    select
      ss.gig_app,
      ss.irs_purpose,
      sum(ss.total_miles) as miles
    from public.session_sections ss
    join public.sessions s on s.id = ss.session_id
    where s.user_id = v_user_id
      and s.date_key between p_start_date and p_end_date
      and (p_vehicle_id is null or s.vehicle_id = p_vehicle_id)
    group by ss.gig_app, ss.irs_purpose
  ),
  totals as (
    select
      coalesce(sum(s.total_miles), 0) as total_miles,
      count(distinct s.id) as total_sessions
    from public.sessions s
    where s.user_id = v_user_id
      and s.date_key between p_start_date and p_end_date
      and (p_vehicle_id is null or s.vehicle_id = p_vehicle_id)
  ),
  sessions_in_range as (
    select s.id, s.date_key, s.total_miles
    from public.sessions s
    where s.user_id = v_user_id
      and s.date_key between p_start_date and p_end_date
      and (p_vehicle_id is null or s.vehicle_id = p_vehicle_id)
  ),
  route_points as (
    select
      sir.id as session_id,
      sir.date_key,
      sir.total_miles,
      coalesce(bc.points, sec.points, '[]'::jsonb) as points
    from sessions_in_range sir
    left join lateral (
      select jsonb_agg(
               jsonb_build_object('lat', b.latitude, 'lng', b.longitude)
               order by b.recorded_at
             ) as points
      from public.session_gps_breadcrumbs b
      where b.session_id = sir.id
    ) bc on true
    left join lateral (
      select jsonb_agg(jsonb_build_object('lat', pt.lat, 'lng', pt.lng) order by pt.ord) as points
      from (
        select ss.start_latitude as lat, ss.start_longitude as lng, ss.start_time as ord
        from public.session_sections ss
        where ss.session_id = sir.id
          and ss.start_latitude is not null and ss.start_longitude is not null
        union all
        select ss.end_latitude as lat, ss.end_longitude as lng, ss.end_time as ord
        from public.session_sections ss
        where ss.session_id = sir.id
          and ss.end_latitude is not null and ss.end_longitude is not null
      ) pt
    ) sec on true
  )
  select jsonb_build_object(
    'driver_display_name', p.full_name,
    'driver_display_id', p.display_id,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'generated_at', now(),
    'total_miles', t.total_miles,
    'total_sessions', t.total_sessions,
    'total_deduction_estimate', v_deduction,
    'vehicles', coalesce((select jsonb_agg(jsonb_build_object(
        'nickname', vr.nickname, 'make', vr.make, 'model', vr.model,
        'year', vr.year, 'plate', vr.plate
      )) from vehicles_in_range vr), '[]'::jsonb),
    'gig_app_breakdown', coalesce((select jsonb_agg(jsonb_build_object(
        'gig_app', pb.gig_app, 'irs_purpose', pb.irs_purpose, 'miles', pb.miles
      )) from purpose_breakdown pb), '[]'::jsonb),
    'weekly_checkpoints', coalesce(p_weekly_checkpoints, '[]'::jsonb),
    'route_points', coalesce((select jsonb_agg(jsonb_build_object(
        'session_id', rp.session_id, 'date_key', rp.date_key,
        'total_miles', rp.total_miles, 'points', rp.points
      ) order by rp.date_key)
      from route_points rp
      where jsonb_array_length(rp.points) >= 2), '[]'::jsonb)
  )
  into v_metadata
  from public.profiles p, totals t
  where p.id = v_user_id;

  v_plain_code := '';
  for i in 1..8 loop
    v_plain_code := v_plain_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;

  insert into public.reports (
    report_type, user_id, organization_id, vehicle_id, start_date, end_date,
    total_miles, total_sessions, generated_by, metadata,
    qr_token, qr_expires_at, qr_uses, qr_max_uses
  ) values (
    'custom', v_user_id, v_organization_id, p_vehicle_id, p_start_date, p_end_date,
    coalesce((v_metadata->>'total_miles')::float8, 0),
    coalesce((v_metadata->>'total_sessions')::int, 0),
    v_caller, v_metadata,
    encode(digest(v_plain_code, 'sha256'), 'hex'), v_expires, 0, 2
  );

  return query select v_plain_code, v_expires;
end;
$$;

revoke all on function public.generate_report_access_code(date, date, uuid, jsonb, uuid) from public;
grant execute on function public.generate_report_access_code(date, date, uuid, jsonb, uuid) to authenticated;
