-- AEO Toolkit — Managed / Autopilot tier schema
--
-- ADDITIVE. Separate from `schema.sql` and `schema-billing.sql`; never edits them. Extends the
-- commercial layer's RLS pattern: a signed-in user reads ONLY their own rows via the anon/publishable
-- key; ALL writes are performed by the service_role key (the orchestrator worker + server actions),
-- which bypasses RLS — so there are deliberately NO insert/update/delete policies for the anon role.
--
-- SECURITY (from the Autopilot review):
--   * C2 — cross-tenant isolation: every table carries `owner_id` (auth.users); RLS-SELECT scopes a
--     user to their own rows. NOTE: RLS-on-SELECT is NOT the authorization control for the
--     service-role mutations the inbox performs — the route MUST still assert
--     `proposal.owner_id = session.user.id` (or a staff role) in app code before executing.
--   * M4 — the audit log is append-only at the DB level: no update/delete policy exists for ANY
--     role here, and the service role only ever inserts. Consent/approval history is immutable.
--
-- Dormant: these tables stay unused until the managed env is configured; the app behaves exactly as
-- today when absent.
--
-- Apply once:  psql "$POSTGRES_URL" -f apps/console/supabase/schema-managed.sql
-- Safe to re-run: every statement is idempotent.

-- ── Customer profiles (one managed site per row; the autopilot cadence target) ──
create table if not exists public.customer_profiles (
  id            text        primary key default gen_random_uuid()::text,
  owner_id      uuid        not null references auth.users (id) on delete cascade,
  site_url      text        not null,
  niche         text,
  topics        text[]      not null default '{}',
  -- cadence targets (the work-delivered SLA)
  articles_per_month            integer not null default 0,
  outreach_placements_per_month integer not null default 0,
  -- captured at onboarding for the 90-day guarantee baseline (visibility/citation coverage snapshot)
  guarantee_baseline jsonb,
  created_at    timestamptz not null default now()
);
alter table public.customer_profiles enable row level security;

drop policy if exists "customer_profiles_select_own" on public.customer_profiles;
create policy "customer_profiles_select_own"
  on public.customer_profiles
  for select
  using (auth.uid() = owner_id);

create index if not exists customer_profiles_owner_idx on public.customer_profiles (owner_id);

-- ── Proposals (the approval inbox: content drafts + outreach pitches awaiting a staff decision) ──
create table if not exists public.proposals (
  id          text        primary key default gen_random_uuid()::text,  -- orchestrator-supplied id
  customer_id text        not null references public.customer_profiles (id) on delete cascade,
  owner_id    uuid        not null references auth.users (id) on delete cascade,
  kind        text        not null check (kind in ('content', 'link-outreach', 'link-placement', 'community-reply')),
  status      text        not null default 'pending'
                          check (status in ('pending', 'approved', 'rejected', 'executed', 'failed')),
  payload     jsonb       not null,
  -- idempotency: one proposal per (customer, kind, period) cadence slot
  dedupe_key  text        not null,
  decided_by  uuid        references auth.users (id),
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.proposals enable row level security;

drop policy if exists "proposals_select_own" on public.proposals;
create policy "proposals_select_own"
  on public.proposals
  for select
  using (auth.uid() = owner_id);

-- Enforce cadence idempotency at the DB level (the orchestrator's dedupe key).
create unique index if not exists proposals_dedupe_uidx on public.proposals (dedupe_key);
create index if not exists proposals_customer_status_idx on public.proposals (customer_id, status);

-- ── Proposal audit (M4: append-only consent/decision history; immutable evidence) ──
-- No update/delete policy for ANY role; the service role only inserts. This is the compliance and
-- dispute record of who approved/rejected what, when, and why.
create table if not exists public.proposal_audit (
  id          bigserial   primary key,
  proposal_id text        not null references public.proposals (id) on delete cascade,
  owner_id    uuid        not null references auth.users (id) on delete cascade,
  action      text        not null check (action in ('created', 'approved', 'rejected', 'executed', 'failed')),
  actor_id    uuid        references auth.users (id),       -- the staff/user who took the action
  rationale   text,                                          -- editorial justification (NOT ranking intent)
  created_at  timestamptz not null default now()
);
alter table public.proposal_audit enable row level security;

drop policy if exists "proposal_audit_select_own" on public.proposal_audit;
create policy "proposal_audit_select_own"
  on public.proposal_audit
  for select
  using (auth.uid() = owner_id);

create index if not exists proposal_audit_proposal_idx on public.proposal_audit (proposal_id);

-- ── Managed jobs (cadence run ledger; lets the orchestrator skip already-run periods) ──
create table if not exists public.managed_jobs (
  id          bigserial   primary key,
  customer_id text        not null references public.customer_profiles (id) on delete cascade,
  owner_id    uuid        not null references auth.users (id) on delete cascade,
  job_kind    text        not null check (job_kind in ('content.generate', 'link.outreach')),
  period      text        not null,                          -- e.g. '2026-06'
  proposals_created integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.managed_jobs enable row level security;

drop policy if exists "managed_jobs_select_own" on public.managed_jobs;
create policy "managed_jobs_select_own"
  on public.managed_jobs
  for select
  using (auth.uid() = owner_id);

-- One run per (customer, job_kind, period) — the orchestrator idempotency guard.
create unique index if not exists managed_jobs_period_uidx on public.managed_jobs (customer_id, job_kind, period);
