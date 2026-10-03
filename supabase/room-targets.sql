-- Run once in Supabase Dashboard -> SQL Editor, after policies.sql.
-- Target ranges per room per harvest cycle, set by admins on Settings -> Targets.
--
-- harvest_cycles already has one row per room per cycle, so a target points at that row
-- (cycle_id) and the room comes with it. Live Rooms uses the targets of each room's running
-- cycle; then any targets the sync writes; then built-in defaults.
--
-- Replaces the first version of this table (one row per room, no cycle). It was empty.

drop table if exists public.room_targets;

create table public.room_targets (
  cycle_id      uuid not null references public.harvest_cycles (id) on delete cascade,
  metric        public.metric_kind not null,      -- temp | rh | co2 | vwc | ec | rzt
  setpoint      numeric,
  target_low    numeric,
  target_high   numeric,
  drift_margin  numeric,
  updated_by    uuid references public.profiles (id),
  updated_at    timestamptz not null default now(),
  primary key (cycle_id, metric)
);

alter table public.room_targets enable row level security;
create policy "team can read"     on public.room_targets for select to authenticated using (public.is_member());
create policy "admins can manage" on public.room_targets for all    to authenticated using (public.is_admin()) with check (public.is_admin());
