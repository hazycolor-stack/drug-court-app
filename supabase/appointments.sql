-- =====================================================================
-- The Drug Court App — appointments + reminder alerts
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once. Run setup.sql and push-notifications.sql first.
-- =====================================================================

-- Appointments used to live only on each person's phone. Saving them here
-- lets the server send a reminder the morning before and the morning of.
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  type text not null default 'IOP',
  date date not null,
  time time,
  notes text not null default '',
  reminded_before_at timestamptz,   -- "tomorrow" reminder sent
  reminded_day_of_at timestamptz,   -- "today" reminder sent
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_user_idx on public.appointments (user_id);
create index if not exists appointments_date_idx on public.appointments (date);

alter table public.appointments enable row level security;

-- People can only see and change their own appointments.
-- The reminder server uses the secret key, which skips these rules.
drop policy if exists "manage own appointments" on public.appointments;
create policy "manage own appointments" on public.appointments
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.appointments to authenticated;

-- If someone moves an appointment to a new day or time, it gets fresh reminders
create or replace function public.appointments_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.date is distinct from old.date or new.time is distinct from old.time then
    new.reminded_before_at := null;
    new.reminded_day_of_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_touch on public.appointments;
create trigger appointments_touch before update on public.appointments
  for each row execute function public.appointments_touch();

-- Appointment reminders can be switched off in Profile → Alerts
alter table public.profiles add column if not exists notify_appointments boolean not null default true;
