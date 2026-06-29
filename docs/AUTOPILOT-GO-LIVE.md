# Autopilot (Managed Tier) — Go-Live Runbook + Browser-Agent Prompt

Everything in PR #7 ships **dormant**. This runbook covers the operational steps to *activate* it. The
code is done and verified; what remains is dashboard configuration (Supabase, Stripe, Vercel), a cron,
and a counsel review. The browser-agent prompt at the bottom automates the dashboard work.

## Environment variables the Managed tier reads
| Var | Purpose | Where used |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | service-role DB access | data/orchestrator (existing) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | auth | login (existing) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | billing | existing |
| `STRIPE_PRICE_MANAGED` | the Managed price id; **also flips `MANAGED_ENABLED`** | entitlements |
| `TOKEN_ENCRYPTION_KEY` | required-encryption token store (H4) | orchestrator trigger |
| `MANAGED_LLM_PROVIDER`, `MANAGED_LLM_API_KEY`, `MANAGED_DRAFT_MODEL`, `MANAGED_REASONING_MODEL` | platform LLM for the done-for-you service | content runner |
| `ORCHESTRATOR_JOB_SECRET` | constant-time auth for the cron trigger (H1); **also flips `MANAGED_ENABLED`** | `/api/orchestrator/run` |
| `STAFF_EMAILS` | comma-separated staff allowlist for the approval inbox | inbox / decision (C2) |
| `PUBLISH_WEBHOOK_URL` (+ optional `DEPLOY_HOOK_URL`) | real CMS publish; absent ⇒ dry-run NoopPublisher | publish-on-approve |

## Order of operations
1. **DB** — apply `apps/console/supabase/schema-managed.sql` and `packages/storage/migrations/0001_oauth_tokens_provider.sql` to the live project.
2. **Stripe** — create the Managed product + recurring price → `STRIPE_PRICE_MANAGED`.
3. **Vercel** — set the env vars above; redeploy.
4. **Cron** — schedule `POST /api/orchestrator/run` with the `x-orchestrator-secret` header.
5. **Smoke test** — verify the pages + the gated endpoints.
6. **Counsel** (human, launch blocker) — review `docs/legal/{MSA-managed,guarantee-terms}.md` before marketing the guarantee.

---

## Browser-Agent Prompt (copy/paste to a computer-use / Playwright agent)

> You are a release operator activating the dormant "Managed/Autopilot" tier of the AEO Toolkit
> (deployed on Vercel as `apps/console`, at aeo.advancelabs.dev). Work through the dashboards below.
>
> **Safety rules (non-negotiable):**
> - You will need secret values (API keys, price ids). **Ask the operator for each secret when you
>   reach the step that needs it — never invent one, never paste a placeholder into a real field.**
> - **Never print full secret values back** in your messages; refer to them as `STRIPE_PRICE_MANAGED`
>   etc. Confirm only the last 4 chars when verifying.
> - **Pause for explicit confirmation before** running any SQL against the production database,
>   before redeploying, and before enabling the cron.
> - If a step's outcome is ambiguous (a dashboard looks different than described), stop and report —
>   do not guess.
>
> **Task 1 — Supabase (apply schema).**
> 1. Open the Supabase dashboard for the project the operator names → SQL Editor.
> 2. Paste the contents of `apps/console/supabase/schema-managed.sql` (operator provides) and, after
>    confirmation, run it. Then do the same for `packages/storage/migrations/0001_oauth_tokens_provider.sql`.
> 3. Verify in the Table Editor that `customer_profiles`, `proposals`, `proposal_audit`, `managed_jobs`
>    exist with **RLS enabled**, and that `oauth_tokens` now has a `provider` column with a composite
>    `(user_id, provider)` primary key. Report what you see.
>
> **Task 2 — Stripe (Managed price).**
> 1. In the Stripe dashboard (live mode after testing in test mode first), create a product
>    "AEO Toolkit — Managed (Autopilot)" with a **recurring monthly** price (operator gives the amount,
>    default $499). Copy the resulting **price id** (`price_…`) — this becomes `STRIPE_PRICE_MANAGED`.
> 2. Confirm the existing billing webhook still points at `/api/billing/webhook`.
>
> **Task 3 — Vercel (env + deploy).**
> 1. Open the Vercel project → Settings → Environment Variables.
> 2. Add/confirm each variable in the runbook's table (operator supplies values). Set them for
>    Production (and Preview if desired). Double-check `ORCHESTRATOR_JOB_SECRET`, `TOKEN_ENCRYPTION_KEY`,
>    `STAFF_EMAILS`, and `STRIPE_PRICE_MANAGED` are present — these gate the tier.
> 3. After confirmation, trigger a redeploy of the latest `main` (post-merge of PR #7).
>
> **Task 4 — Cron (orchestrator trigger).**
> 1. Add a scheduled job (Vercel Cron, or the operator's scheduler) that sends `POST` to
>    `https://aeo.advancelabs.dev/api/orchestrator/run` with header `x-orchestrator-secret: <ORCHESTRATOR_JOB_SECRET>`,
>    on the cadence the operator wants (e.g. daily 09:00 UTC).
> 2. Do NOT hardcode the secret into a public place; use the platform's secret store.
>
> **Task 5 — Smoke test (live site).**
> 1. Visit `/pricing` → confirm the **Managed/Autopilot** card renders with the $499 price and
>    "penalty-safe / human-vetted / guaranteed" copy.
> 2. `POST /api/orchestrator/run` **without** the secret header → expect **404**. With the correct
>    header → expect **200** JSON (`{"ran":…}`). Report both.
> 3. Visit `/inbox` while signed out or as a non-staff user → expect the "restricted to staff" notice.
> 4. As a `STAFF_EMAILS` user, visit `/inbox` → expect the pending-proposals UI (likely empty initially).
> 5. As a user with an active Managed subscription, visit `/onboarding`, submit a test site → expect a
>    success message and a new `customer_profiles` row (check Supabase).
>
> **Deliverable:** a checklist report of each task (done / blocked), the last-4 of each secret you set
> (never the full value), the smoke-test HTTP results, and anything you had to stop on. Explicitly note
> that the **legal review of the MSA + guarantee terms is a human task you did NOT perform** and is a
> launch blocker.

---

*The browser agent handles config + smoke tests. It does NOT replace: merging PR #7, the counsel review
of the legal docs, or wiring a specific CMS's webhook format (set `PUBLISH_WEBHOOK_URL` to that CMS's
ingest endpoint — until then publishing is a safe dry-run).*
