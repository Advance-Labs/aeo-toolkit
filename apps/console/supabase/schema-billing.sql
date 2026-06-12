-- AEO Toolkit — Commercial layer (auth + billing) schema
--
-- ADDITIVE. This file is separate from `schema.sql` and never edits it. It introduces the FIRST
-- policy-bearing RLS in the project: signed-in users may read ONLY their own row via the anon/
-- publishable key. All writes are performed by the service_role key (Stripe webhook + server
-- actions), which bypasses RLS — so there are deliberately NO insert/update/delete policies for the
-- anon role. With no policy granting them, anon writes are denied by default while service-role
-- writes still work.
--
-- These tables stay dormant until auth + billing env vars are configured; the app behaves exactly as
-- today (all tools free and open) when they are absent.
--
-- Apply once after provisioning:  psql "$POSTGRES_URL" -f apps/console/supabase/schema-billing.sql
-- (or paste into the Supabase SQL editor). Safe to re-run: every statement is idempotent.

-- ── Profiles (one row per auth user; seeded by the on-signup trigger below) ──
create table if not exists public.profiles (
  id                 uuid        primary key references auth.users (id) on delete cascade,
  email              text,
  stripe_customer_id text,                                  -- nullable until first checkout
  created_at         timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- A signed-in user reads only their own profile. No insert/update/delete policy → anon writes denied;
-- the service role bypasses RLS for webhook/server writes.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

-- ── Subscriptions (one active subscription per user; upserted by the Stripe webhook) ──
create table if not exists public.subscriptions (
  user_id                uuid        primary key references auth.users (id) on delete cascade,
  stripe_subscription_id text,
  status                 text,                               -- e.g. active, trialing, past_due, canceled
  price_id               text,
  plan                   text,                               -- resolved PlanId: free | pro | agency
  current_period_end     timestamptz,
  cancel_at_period_end   boolean     not null default false
);
alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- ── Usage events (append-only meter for monthly quota enforcement) ──
create table if not exists public.usage_events (
  id         bigserial   primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  feature    text        not null,                           -- audit | mcp | graph | chat | ...
  created_at timestamptz not null default now()
);
alter table public.usage_events enable row level security;

-- Composite index supports the hot path: count this month's events for a user.
create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at);

drop policy if exists "usage_events_select_own" on public.usage_events;
create policy "usage_events_select_own"
  on public.usage_events
  for select
  using (auth.uid() = user_id);

-- ── Seed a profile row whenever a new auth user is created ──
-- SECURITY DEFINER so the trigger can insert into public.profiles regardless of the inserting role.
-- `set search_path = ''` hardens the function against search-path hijacking; all objects are schema-
-- qualified. `on conflict do nothing` keeps it idempotent if a profile already exists.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
