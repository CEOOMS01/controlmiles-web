-- Fleet driver roster slots: lets an admin create a driver record by
-- name alone (CM-D#### assigned immediately) without that person
-- needing a ControlMiles account yet -- fixes the real chicken-and-egg
-- gap in invite_member_by_email, which requires the invitee to already
-- have signed up. A driver later "claims" their slot with a one-time
-- claim code (hashed at rest, never the same value as the public
-- CM-D#### shown on rosters/reports -- that one's meant to be
-- human-readable, not a secret).
--
-- User's explicit design: a truck/vehicle is never fixed to a driver
-- nor a driver to a truck (vehicles.assigned_driver_id already supports
-- this, freely reassignable -- no schema change needed there). Every
-- fleet's data lives strictly under that fleet's own organization_id,
-- so no admin can ever see another admin's roster or vehicles -- this
-- is already the existing RLS posture (is_org_admin_or_owner) and this
-- migration extends it to the two new pieces, not a new privacy model.

-- ── Vehicle display IDs (CM-T####), same pattern as profiles' own
--    CM-<letter><6 digits> generator (fn_assign_profile_display_id),
--    just a different prefix/width to match the format asked for. ──
alter table public.vehicles add column if not exists display_id text unique;
comment on column public.vehicles.display_id is 'Human-facing fleet vehicle ID, CM-T####. Assigned automatically on insert, never user-editable.';

create or replace function public.fn_assign_vehicle_display_id()
returns trigger
language plpgsql
as $$
declare
  v_digits text;
  v_new_id text;
  v_attempts int := 0;
  v_max int := 200;
begin
  if NEW.display_id is null or btrim(NEW.display_id) = '' then
    loop
      v_digits := LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
      v_new_id := 'CM-T' || v_digits;

      exit when not exists (select 1 from public.vehicles where display_id = v_new_id);

      v_attempts := v_attempts + 1;
      if v_attempts >= v_max then
        raise exception '[ControlMiles] Could not generate a unique vehicle ID after % attempts.', v_max;
      end if;
    end loop;
    NEW.display_id := v_new_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_assign_vehicle_display_id on public.vehicles;
create trigger trg_assign_vehicle_display_id
  before insert on public.vehicles
  for each row execute function public.fn_assign_vehicle_display_id();

-- Backfill display_id for any vehicles that already existed before
-- this column did -- both of the real account's real vehicles.
update public.vehicles
set display_id = 'CM-T' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0')
where display_id is null;

-- ── Driver roster slots ──────────────────────────────────────────────
create table public.fleet_driver_slots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  display_id text unique,
  claim_code_hash text not null,
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
comment on table public.fleet_driver_slots is 'Admin-created driver roster entries, claimable by a real account later via a one-time hashed code. Not the same thing as organization_members -- that gets a real row only once claimed.';
comment on column public.fleet_driver_slots.claim_code_hash is 'SHA-256 hex hash of the one-time claim code. The plaintext is returned once, at creation, and never stored.';

alter table public.fleet_driver_slots enable row level security;

create policy fleet_driver_slots_select_admin on public.fleet_driver_slots
for select to authenticated
using (is_org_admin_or_owner(organization_id));

create policy fleet_driver_slots_delete_admin on public.fleet_driver_slots
for delete to authenticated
using (is_org_admin_or_owner(organization_id));
-- No direct INSERT/UPDATE policy -- creation and claiming both go
-- through SECURITY DEFINER RPCs (create_driver_slot / claim_driver_slot)
-- so the display_id generation, claim-code hashing, and the
-- organization_members/profiles side effects of claiming can never be
-- bypassed by a raw table write.

create or replace function public.fn_assign_driver_slot_display_id()
returns trigger
language plpgsql
as $$
declare
  v_digits text;
  v_new_id text;
  v_attempts int := 0;
  v_max int := 200;
begin
  if NEW.display_id is null or btrim(NEW.display_id) = '' then
    loop
      v_digits := LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
      v_new_id := 'CM-D' || v_digits;

      exit when not exists (select 1 from public.fleet_driver_slots where display_id = v_new_id);

      v_attempts := v_attempts + 1;
      if v_attempts >= v_max then
        raise exception '[ControlMiles] Could not generate a unique driver ID after % attempts.', v_max;
      end if;
    end loop;
    NEW.display_id := v_new_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_assign_driver_slot_display_id on public.fleet_driver_slots;
create trigger trg_assign_driver_slot_display_id
  before insert on public.fleet_driver_slots
  for each row execute function public.fn_assign_driver_slot_display_id();

-- ── Claim rate limiting (per authenticated caller, not per IP -- the
--    claimer is always signed in, unlike the anonymous Report Portal
--    preparer) ──────────────────────────────────────────────────────
create table public.driver_slot_claim_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  success boolean not null,
  slot_id uuid references public.fleet_driver_slots(id) on delete set null,
  attempted_at timestamptz not null default now()
);
alter table public.driver_slot_claim_attempts enable row level security;
-- Deliberately zero policies, same reasoning as report_access_attempts:
-- only the claim_driver_slot RPC (SECURITY DEFINER) ever touches this.

create index idx_driver_slot_claim_attempts_user_time
  on public.driver_slot_claim_attempts (user_id, attempted_at desc);

-- ── Create a slot (admin/owner only) ─────────────────────────────────
create or replace function public.create_driver_slot(
  p_org_id uuid,
  p_first_name text,
  p_last_name text
)
returns table(slot_id uuid, display_id text, claim_code text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller uuid := auth.uid();
  v_code text;
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  v_slot_id uuid;
  v_display_id text;
  i int;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  if not is_org_admin_or_owner(p_org_id) then
    raise exception 'Only an org admin or owner can add drivers';
  end if;

  if btrim(coalesce(p_first_name, '')) = '' or btrim(coalesce(p_last_name, '')) = '' then
    raise exception 'First and last name are required';
  end if;

  v_code := '';
  for i in 1..8 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;

  insert into public.fleet_driver_slots (
    organization_id, first_name, last_name, claim_code_hash, created_by
  ) values (
    p_org_id, btrim(p_first_name), btrim(p_last_name),
    encode(digest(v_code, 'sha256'), 'hex'), v_caller
  )
  returning id, fleet_driver_slots.display_id into v_slot_id, v_display_id;

  return query select v_slot_id, v_display_id, v_code;
end;
$$;

revoke all on function public.create_driver_slot(uuid, text, text) from public;
revoke all on function public.create_driver_slot(uuid, text, text) from anon;
grant execute on function public.create_driver_slot(uuid, text, text) to authenticated;

-- ── Claim a slot (any authenticated driver, code is the credential) ──
create or replace function public.claim_driver_slot(
  p_claim_code text
)
returns table(success boolean, message text, organization_name text, display_id text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller uuid := auth.uid();
  v_recent_failures int;
  v_hash text;
  v_slot record;
  v_caller_account_type text;
  v_org_name text;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  select count(*) into v_recent_failures
  from public.driver_slot_claim_attempts a
  where a.user_id = v_caller
    and a.success = false
    and a.attempted_at > now() - interval '15 minutes';

  if v_recent_failures >= 5 then
    return query select false, 'Too many attempts. Try again later.', null::text, null::text;
    return;
  end if;

  select account_type into v_caller_account_type from public.profiles where id = v_caller;
  if v_caller_account_type = 'fleet_admin' then
    insert into public.driver_slot_claim_attempts (user_id, success, slot_id) values (v_caller, false, null);
    return query select false, 'You already manage your own fleet and cannot join another as a driver.', null::text, null::text;
    return;
  end if;

  v_hash := encode(digest(coalesce(p_claim_code, ''), 'sha256'), 'hex');

  select * into v_slot
  from public.fleet_driver_slots s
  where s.claim_code_hash = v_hash
    and s.claimed_by is null
  limit 1;

  if not found then
    insert into public.driver_slot_claim_attempts (user_id, success, slot_id) values (v_caller, false, null);
    return query select false, 'Invalid or already-claimed code.', null::text, null::text;
    return;
  end if;

  update public.fleet_driver_slots
  set claimed_by = v_caller, claimed_at = now()
  where id = v_slot.id;

  insert into public.organization_members (organization_id, user_id, member_role, is_active, joined_at)
  values (v_slot.organization_id, v_caller, 'driver', true, now())
  on conflict do nothing;

  update public.profiles
  set account_type = 'fleet_driver', default_org_id = v_slot.organization_id
  where id = v_caller;

  select name into v_org_name from public.organizations where id = v_slot.organization_id;

  insert into public.driver_slot_claim_attempts (user_id, success, slot_id) values (v_caller, true, v_slot.id);

  return query select true, 'ok', v_org_name, v_slot.display_id;
end;
$$;

revoke all on function public.claim_driver_slot(text) from public;
revoke all on function public.claim_driver_slot(text) from anon;
grant execute on function public.claim_driver_slot(text) to authenticated;
