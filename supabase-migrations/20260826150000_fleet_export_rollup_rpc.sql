-- Roadmap Phase 5's disclosed gap: "Fleet-wide PDF/CSV export across
-- every driver, not just one at a time." Every report today
-- (report_service.dart's PDF, the Report Portal's generate_report_
-- access_code) is per-driver. This RPC does the heavy aggregation
-- server-side, one round trip, admin-only -- one row per driver who
-- had any activity in the date range, with their totals and vehicles
-- used. Deliberately a rollup, not full gig-app/purpose granularity
-- per driver (that level of detail already exists per-driver via the
-- Report Portal) -- a fleet-wide export's job is the cross-driver
-- totals table, matching the roadmap's own "one export a bookkeeper
-- can actually file with" framing.
--
-- Verified live: real test sessions (2 sessions, 77.5mi combined) for
-- one driver aggregated correctly with driver name/id and vehicle
-- info; a non-admin caller correctly rejected. Test data cleaned up.
create or replace function public.get_fleet_export_data(
  p_org_id uuid,
  p_start_date date,
  p_end_date date
)
returns table(
  user_id uuid,
  driver_name text,
  driver_display_id text,
  total_miles double precision,
  total_sessions bigint,
  vehicles jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not is_org_admin_or_owner(p_org_id) then
    raise exception 'Only an org admin or owner can export fleet-wide data';
  end if;

  return query
  select
    s.user_id,
    p.full_name as driver_name,
    p.display_id as driver_display_id,
    coalesce(sum(s.total_miles), 0) as total_miles,
    count(distinct s.id) as total_sessions,
    coalesce(
      (select jsonb_agg(distinct jsonb_build_object(
        'display_id', v.display_id, 'make', v.make, 'model', v.model, 'nickname', v.nickname
      ))
      from public.vehicles v
      where v.id in (
        select s2.vehicle_id from public.sessions s2
        where s2.user_id = s.user_id
          and s2.organization_id = p_org_id
          and s2.date_key between p_start_date and p_end_date
          and s2.vehicle_id is not null
      )),
      '[]'::jsonb
    ) as vehicles
  from public.sessions s
  join public.profiles p on p.id = s.user_id
  where s.organization_id = p_org_id
    and s.date_key between p_start_date and p_end_date
  group by s.user_id, p.full_name, p.display_id
  order by total_miles desc;
end;
$$;

revoke all on function public.get_fleet_export_data(uuid, date, date) from public;
revoke all on function public.get_fleet_export_data(uuid, date, date) from anon;
grant execute on function public.get_fleet_export_data(uuid, date, date) to authenticated;
