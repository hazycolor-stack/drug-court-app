-- =====================================================================
-- The Drug Court App — database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- =====================================================================

-- ---------- Profiles (one row per signed-up person) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  state text,
  program text,
  sober_date date,
  bio text default '',
  avatar text default '',            -- cartoon avatar id
  avatar_url text,                   -- uploaded profile photo
  header_url text,                   -- uploaded header (cover) photo
  phase_start int default 2,
  phase_start_month text,
  testing_slot text check (testing_slot in ('morning', 'afternoon')),
  testing_slot_changed_at timestamptz,
  notify_general boolean not null default true,
  notify_jobs boolean not null default true,
  notify_events boolean not null default true,
  role text not null default 'participant' check (role in ('participant', 'staff', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Is the signed-in person staff or admin?
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff', 'admin')
  );
$$;

drop policy if exists "read own profile or staff reads all" on public.profiles;
create policy "read own profile or staff reads all" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists "update own profile or staff updates all" on public.profiles;
create policy "update own profile or staff updates all" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_staff())
  with check (id = auth.uid() or public.is_staff());

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

grant select, insert, update on public.profiles to authenticated;

-- Create the profile row automatically when someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  slot text := new.raw_user_meta_data->>'testing_slot';
begin
  insert into public.profiles (id, full_name, email, phone, state, program, testing_slot, testing_slot_changed_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    nullif(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'state', ''),
    nullif(new.raw_user_meta_data->>'program', ''),
    case when slot in ('morning', 'afternoon') then slot end,
    case when slot in ('morning', 'afternoon') then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Guard rails on profile edits:
--  * only admins can change anyone's role
--  * participants can change their testing slot only once every 6 months
--    (staff/admins can override any time)
create or replace function public.guard_profile_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Changes made by you directly in the Supabase dashboard / SQL editor are always allowed
  if auth.uid() is null then
    return new;
  end if;

  if new.role is distinct from old.role and not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only an admin can change roles';
  end if;

  -- Participants can't edit the "last changed" date by hand
  if new.testing_slot is not distinct from old.testing_slot and not public.is_staff() then
    new.testing_slot_changed_at := old.testing_slot_changed_at;
  end if;

  if new.testing_slot is distinct from old.testing_slot then
    if not public.is_staff()
       and old.testing_slot is not null
       and old.testing_slot_changed_at is not null
       and old.testing_slot_changed_at > now() - interval '6 months' then
      raise exception 'Testing time can only be changed once every 6 months';
    end if;
    new.testing_slot_changed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------- Announcements (the feed) ----------
create table if not exists public.announcements (
  id bigint generated always as identity primary key,
  category text not null check (category in ('testing', 'jobs', 'events', 'general')),
  testing_slot text check (testing_slot in ('morning', 'afternoon')),
  phases int[] not null default '{}',
  body text not null,
  link text,
  pinned boolean not null default false,
  expires_at timestamptz,
  author_id uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "signed-in users read announcements" on public.announcements;
create policy "signed-in users read announcements" on public.announcements
  for select to authenticated using (true);

drop policy if exists "staff post announcements" on public.announcements;
create policy "staff post announcements" on public.announcements
  for insert to authenticated with check (public.is_staff());

drop policy if exists "staff edit announcements" on public.announcements;
create policy "staff edit announcements" on public.announcements
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff delete announcements" on public.announcements;
create policy "staff delete announcements" on public.announcements
  for delete to authenticated using (public.is_staff());

grant select, insert, update, delete on public.announcements to authenticated;

-- New posts show up instantly in the app
do $$
begin
  alter publication supabase_realtime add table public.announcements;
exception when duplicate_object then null;
end $$;

-- ---------- Photo storage (profile + header photos) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Each person can only upload/replace/delete files in their own folder
drop policy if exists "upload own photos" on storage.objects;
create policy "upload own photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "read own photos" on storage.objects;
create policy "read own photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "update own photos" on storage.objects;
create policy "update own photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "delete own photos" on storage.objects;
create policy "delete own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- AFTER you sign up in the app yourself, make yourself the admin:
-- (replace the email with yours, then run just this line)
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
--
-- To let a court coordinator post, run the same line with role = 'staff'.
-- =====================================================================
