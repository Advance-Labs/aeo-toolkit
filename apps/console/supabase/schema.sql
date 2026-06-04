-- AEO Toolkit — Supabase schema
--
-- The console reaches Supabase via the service_role key (which bypasses RLS). RLS is enabled on both
-- tables with NO permissive policies, so the anon/public key can never read them — the sensitive
-- oauth_tokens rows are only reachable with the service role on the server.
--
-- Apply once after provisioning:  psql "$POSTGRES_URL" -f apps/console/supabase/schema.sql
-- (or paste into the Supabase SQL editor). Column shapes match @aeo/storage SupabaseTokenStore and
-- @aeo/blogging SupabasePostStore.

-- ── OAuth tokens (GA4 + Search Console connections; chat + ga-gsc MCP) ──
create table if not exists public.oauth_tokens (
  user_id       text primary key,
  access_token  text   not null,
  refresh_token text,
  expires_at    bigint not null,            -- unix milliseconds
  scope         text   not null default ''
);
alter table public.oauth_tokens enable row level security;

-- ── Blog posts (autonomous blogging agent / cron) ──
create table if not exists public.posts (
  slug            text primary key,
  title           text    not null,
  primary_keyword text    not null default '',
  status          text    not null,
  markdown        text    not null,
  fingerprint     text[]  not null default '{}',
  created_at      text    not null,
  updated_at      text    not null,
  scheduled_for   text,                       -- nullable: pending schedule date
  published_at    text,                        -- nullable
  url             text,                        -- nullable: canonical URL once published
  health          jsonb,                       -- nullable: GSC/GA4 health snapshot
  revision_count  integer not null default 0
);
alter table public.posts enable row level security;
