-- Run once in Supabase Dashboard -> SQL Editor, after policies.sql.
-- Per-person feature access for staff, set by admins on the Team page. Admins always have every
-- feature. Existing staff get the access they had before: live rooms, room detail and data entry.
--
--   live_rooms | room_detail | ai_reports | harvests | data_entry

alter table public.profiles
  add column permissions text[] not null default '{live_rooms,room_detail,data_entry}'
  check (
    cardinality(permissions) > 0
    and permissions <@ '{live_rooms,room_detail,ai_reports,harvests,data_entry}'::text[]
  );

-- True when the signed-in user is an active admin, or active staff with feature `p` turned on.
create or replace function public.has_perm(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and is_active and (role = 'admin' or p = any (permissions))
  );
$$;

-- Leachate captures: only people with Data entry can add or correct rows.
drop policy if exists "team can add" on public.leachate_log;
create policy "team can add" on public.leachate_log for insert to authenticated
  with check (public.has_perm('data_entry'));

drop policy if exists "team can update" on public.leachate_log;
create policy "team can update" on public.leachate_log for update to authenticated
  using (public.has_perm('data_entry')) with check (public.has_perm('data_entry'));

-- AI reports: admins and staff with AI crop reports can save a generated report.
drop policy if exists "admins can add" on public.crop_reports;
create policy "ai reports can add" on public.crop_reports for insert to authenticated
  with check (public.has_perm('ai_reports'));

-- Make the API see the new column right away (otherwise: "Could not find the 'permissions' column").
notify pgrst, 'reload schema';
