-- Run once in Supabase Dashboard -> SQL Editor, after profiles.sql.
-- Lets signed-in team members read the data; staff add leachate rows; admins manage the rest.
-- (The SkySpark / Aroya sync uses the service role key, which skips these rules.)

-- True when the signed-in user has an active profile.
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active);
$$;

-- Everyone on the team can read.
create policy "team can read" on public.rooms                for select to authenticated using (public.is_member());
create policy "team can read" on public.environment_current  for select to authenticated using (public.is_member());
create policy "team can read" on public.environment_readings for select to authenticated using (public.is_member());
create policy "team can read" on public.rootzone_current     for select to authenticated using (public.is_member());
create policy "team can read" on public.rootzone_readings    for select to authenticated using (public.is_member());
create policy "team can read" on public.daily_records        for select to authenticated using (public.is_member());
create policy "team can read" on public.harvest_cycles       for select to authenticated using (public.is_member());
create policy "team can read" on public.harvest_reports      for select to authenticated using (public.is_member());
create policy "team can read" on public.leachate_log         for select to authenticated using (public.is_member());
create policy "team can read" on public.crop_reports         for select to authenticated using (public.is_member());

-- Staff and admins add leachate captures (Data Entry).
create policy "team can add" on public.leachate_log for insert to authenticated with check (public.is_member());
-- ...and correct rows already saved (Data Entry → Recently saved → Update).
create policy "team can update" on public.leachate_log for update to authenticated using (public.is_member()) with check (public.is_member());

-- Admins save AI reports.
create policy "admins can add" on public.crop_reports for insert to authenticated with check (public.is_admin());
