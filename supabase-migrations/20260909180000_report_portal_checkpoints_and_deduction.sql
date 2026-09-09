-- Extends generate_report_access_code (20260826100000_report_portal_access_codes.sql)
-- with two things the web Report Portal was missing vs. the mobile PDF:
--
-- 1. total_deduction_estimate -- mirrors lib/data/irs_rates.dart's per-trip,
--    date-bucketed IRS standard mileage rate (72.5c/mile Jan1-Jun30 2026,
--    76c/mile Jul1-Dec31 2026 -- first mid-year IRS change since 2022;
--    confirmed live against irs.gov in that file's own history). Same
--    "one flat rate silently underprices anything spanning Jul 1" bug this
--    was already fixed for on mobile -- summing session.total_miles by
--    date_key bucket here, not one rate for the whole period. MUST be kept
--    in sync with lib/data/irs_rates.dart by hand when the IRS publishes a
--    new year's rate (same manual-sync discipline as ERROR_CODES.md).
--
-- 2. weekly_checkpoints -- the odometer-photo pairs vehicle_detail_screen.dart
--    already shows on mobile (20260903120000_vehicle_weekly_odometer_checkpoints.sql),
--    now surfaced on the emailed/shared report too. Photo SIGNING can't happen
--    in SQL (Storage signing is an HTTP capability, not a Postgres one), and
--    the "odometers" bucket is private with RLS scoped to the *uploader's*
--    auth.uid() folder -- so this function accepts the already-signed URLs as
--    a jsonb param, computed by the caller's own authenticated client (which
--    has legitimate RLS access to their own files) before calling this RPC.
--    This keeps the web app's "no service-role key anywhere" posture intact
--    (see 20260826100000's own header comment) -- signing happens as the
--    driver, not as a backend master key. Both callers -- this repo's
--    portal/generate/actions.ts and the mobile app's
--    generate_report_code_screen.dart -- fetch+sign checkpoints client-side
--    and pass the same jsonb shape in.
create or replace function public.generate_report_access_code(
  p_start_date date,
  p_end_date date,
  p_vehicle_id uuid default null,
  p_weekly_checkpoints jsonb default '[]'::jsonb
)
returns table(code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_recent_count int;
  v_plain_code text;
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  v_expires timestamptz := now() + interval '15 minutes';
  v_metadata jsonb;
  v_deduction numeric;
  i int;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_end_date < p_start_date then
    raise exception 'Invalid date range';
  end if;

  select count(*) into v_recent_count
  from public.reports
  where user_id = v_user_id
    and generated_at > now() - interval '1 hour';

  if v_recent_count >= 5 then
    raise exception 'Too many report codes generated recently. Try again later.';
  end if;

  -- IRS half-year rate cutoff, mirrored from lib/data/irs_rates.dart's
  -- ratePerMileCentsForDate(): date < Jul 1 2026 -> 72.5c/mile (this also
  -- correctly covers every pre-2026 date, same fallback the Dart file
  -- documents), date >= Jul 1 2026 -> 76c/mile (also covers 2027+ until
  -- next year's real rate is added here by hand).
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
    'weekly_checkpoints', coalesce(p_weekly_checkpoints, '[]'::jsonb)
  )
  into v_metadata
  from public.profiles p, totals t
  where p.id = v_user_id;

  v_plain_code := '';
  for i in 1..8 loop
    v_plain_code := v_plain_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;

  insert into public.reports (
    report_type, user_id, vehicle_id, start_date, end_date,
    total_miles, total_sessions, generated_by, metadata,
    qr_token, qr_expires_at, qr_uses, qr_max_uses
  ) values (
    'custom', v_user_id, p_vehicle_id, p_start_date, p_end_date,
    coalesce((v_metadata->>'total_miles')::float8, 0),
    coalesce((v_metadata->>'total_sessions')::int, 0),
    v_user_id, v_metadata,
    encode(digest(v_plain_code, 'sha256'), 'hex'), v_expires, 0, 2
  );

  return query select v_plain_code, v_expires;
end;
$$;

revoke all on function public.generate_report_access_code(date, date, uuid, jsonb) from public;
grant execute on function public.generate_report_access_code(date, date, uuid, jsonb) to authenticated;

-- Old 3-arg signature is superseded by CREATE OR REPLACE only when the
-- parameter list is identical; adding a 4th param creates a NEW overload
-- instead, so the stale 3-arg one must be dropped explicitly or both would
-- coexist (the app always calls with 4 args going forward, but leaving a
-- dead 3-arg overload around is exactly the kind of drift this project's
-- memory flags as a real recurring bug class).
drop function if exists public.generate_report_access_code(date, date, uuid);
