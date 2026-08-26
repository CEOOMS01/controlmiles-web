-- New data model: route/dispatch creation, the one item from the
-- roadmap that genuinely needed new modeling (everything else this
-- session ported existing mobile screens or extended existing tables).
-- v1 scope: admin creates/edits a route while draft/active, then closes
-- it -- once closed, frozen forever, same immutability rule as
-- sessions/session_sections ("ni rutas... siempre que estén guardadas
-- y cerradas"). Mobile-side "driver sees their assigned route" is left
-- for a follow-up (RLS is ready for it now, UI is not built this pass).
--
-- Verified live: create (draft) -> close (status='closed', closed_at
-- auto-set) -> further UPDATE blocked -> DELETE also blocked (only
-- allowed while draft). Test row cleaned up afterward.
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  origin text,
  destination text,
  assigned_driver_id uuid references public.profiles(id),
  assigned_vehicle_id uuid references public.vehicles(id),
  scheduled_date date,
  notes text,
  status text not null default 'draft' check (status = any (array['draft','active','closed'])),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
comment on table public.routes is 'Fleet route/dispatch. Admin-managed (web only, per the standing "heavy planning modules go to web" decision). Frozen once status=closed, same rule as sessions/session_sections.';

alter table public.routes enable row level security;

create policy routes_select_admin on public.routes
for select to authenticated
using (is_org_admin_or_owner(organization_id));

create policy routes_select_assigned_driver on public.routes
for select to authenticated
using (assigned_driver_id = auth.uid());

create policy routes_insert_admin on public.routes
for insert to authenticated
with check (is_org_admin_or_owner(organization_id) and created_by = auth.uid());

create policy routes_update_admin on public.routes
for update to authenticated
using (is_org_admin_or_owner(organization_id))
with check (is_org_admin_or_owner(organization_id));

create policy routes_delete_admin on public.routes
for delete to authenticated
using (is_org_admin_or_owner(organization_id) and status = 'draft');

create or replace function public.fn_freeze_closed_route()
returns trigger
language plpgsql
as $$
begin
  if OLD.status = 'closed' then
    raise exception 'Cannot modify a closed route';
  end if;
  if NEW.status = 'closed' and OLD.status is distinct from 'closed' then
    NEW.closed_at := now();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_freeze_closed_route on public.routes;
create trigger trg_freeze_closed_route
  before update on public.routes
  for each row execute function public.fn_freeze_closed_route();

create index idx_routes_org_status on public.routes (organization_id, status);
