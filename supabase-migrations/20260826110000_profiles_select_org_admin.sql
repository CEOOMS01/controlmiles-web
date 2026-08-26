-- Real gap found while building the web admin panel: profiles only had
-- a SELECT policy for auth.uid() = id. An org admin querying the
-- roster (organization_members joined to profiles for names/emails)
-- would have silently gotten NULL for every teammate's profile --
-- RLS filters unreadable rows out of a join instead of erroring, so
-- this would have shipped as a roster full of blank names, not a
-- visible bug. Scoped tightly: an admin can only read the profile of
-- someone who is (or was) a member of an org they administer.
--
-- Verified live (request.jwt.claims simulation): the org owner can now
-- read a teammate's profile; a plain driver still cannot read the
-- owner's profile (0 rows) -- confirms this is admin-only, not
-- "any member of the same org can see anyone."
create policy profiles_select_org_admin on public.profiles
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.user_id = profiles.id
      and is_org_admin_or_owner(om.organization_id)
  )
);
