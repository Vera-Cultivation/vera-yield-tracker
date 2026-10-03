-- Run once in Supabase Dashboard -> SQL Editor, after policies.sql.
-- Lets admins create, edit and close harvest cycles on the Settings page, and stamp
-- daily_records with the cycle they fall in.

create policy "admins can manage" on public.harvest_cycles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admins can manage" on public.daily_records for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
