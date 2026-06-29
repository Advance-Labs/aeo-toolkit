-- Migration 0001 — oauth_tokens: composite (user_id, provider) key  (security §H4)
--
-- Additive and idempotent. Existing rows are PRESERVED and back-filled with provider = 'google'
-- (every pre-H4 row is a Google OAuth connection). Nothing is dropped or truncated.
--
-- Before: PRIMARY KEY (user_id)            — Google/Reddit/CMS tokens for one user collide.
-- After:  PRIMARY KEY (user_id, provider)  — one independent row per (user, provider).
--
-- Apply once (after apps/console/supabase/schema.sql):
--   psql "$POSTGRES_URL" -f packages/storage/migrations/0001_oauth_tokens_provider.sql
-- (or paste into the Supabase SQL editor). Safe to re-run.

begin;

-- 1. Add the provider column with a default so existing rows are back-filled in place.
alter table public.oauth_tokens
  add column if not exists provider text not null default 'google';

-- 2. Belt-and-suspenders back-fill for any row that somehow has a null/empty provider.
update public.oauth_tokens
  set provider = 'google'
  where provider is null or provider = '';

-- 3. Constrain provider to the known TokenProvider set (matches @aeo/types TokenProvider).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'oauth_tokens_provider_check'
  ) then
    alter table public.oauth_tokens
      add constraint oauth_tokens_provider_check
      check (provider in ('google', 'reddit', 'cms'));
  end if;
end $$;

-- 4. Swap the single-column primary key for the composite (user_id, provider).
--    Drop by the conventional pkey name; re-add only if a composite PK isn't already present.
alter table public.oauth_tokens drop constraint if exists oauth_tokens_pkey;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.oauth_tokens'::regclass and contype = 'p'
  ) then
    alter table public.oauth_tokens
      add constraint oauth_tokens_pkey primary key (user_id, provider);
  end if;
end $$;

commit;
