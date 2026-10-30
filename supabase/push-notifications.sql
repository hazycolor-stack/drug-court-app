-- =====================================================================
-- The Drug Court App — push notifications (lock-screen alerts)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once. Run setup.sql first.
-- =====================================================================

-- One row per phone that has turned on alerts.
-- (A person can have more than one phone.)
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- People can only see, add and remove their own phones.
-- The server that sends alerts uses the secret key, which skips these rules.
drop policy if exists "manage own push subscriptions" on public.push_subscriptions;
create policy "manage own push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Save this phone for the signed-in person. If someone else used to be
-- signed in on the same phone, their alerts move over to the new person.
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh,
        auth = excluded.auth, user_agent = excluded.user_agent, created_at = now();
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- Marks a post once its alert has gone out, so it can never be sent twice
alter table public.announcements add column if not exists notified_at timestamptz;

-- Testing alerts can be switched off too (jobs / events / general already exist)
alter table public.profiles add column if not exists notify_testing boolean not null default true;
