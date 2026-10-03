-- Run once in Supabase Dashboard -> SQL Editor.
-- One row per login: id is the user's id from Authentication -> Users.

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  role        text not null default 'staff' check (role in ('admin', 'staff')),
  is_active   boolean not null default true,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

-- True when the signed-in user is an active admin. (A function, so the policies below
-- can check profiles without looping back into their own policy.)
create function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and is_active);
$$;

alter table public.profiles enable row level security;
create policy "signed in can read"  on public.profiles for select to authenticated using (true);
create policy "admins can add"      on public.profiles for insert to authenticated with check (public.is_admin());
create policy "admins can update"   on public.profiles for update to authenticated using (public.is_admin());

-- First admin: the user created in Authentication -> Users.
insert into public.profiles (id, full_name, email, role)
values ('0fa291ef-2b45-4a1d-8373-72b9532236d5', 'Admin', 'admin@gmail.com', 'admin');
