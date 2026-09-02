---
title: Deployment
description: >-
  Deploying the console as a single Vercel project, plus the Chrome extension, with the root-directory and Turbo build gotchas.
---

The suite deploys as **one Vercel project** (`apps/console`) plus the Chrome extension (built from the
repo, shipped via the Web Store). One domain, one env set.

| Piece | Target | How |
|-------|--------|-----|
| `apps/console` — all tools + MCP + blogging cron | **Vercel** (one project) | Root Directory = `apps/console`, framework Next.js, install/build at repo root with pnpm + Turbo |
| `apps/chrome-extension` | Chrome Web Store | `pnpm --filter @advance-labs/chrome-extension build` → zip `dist/` → upload |

---

## Current deployment (live)

- **Project:** `advancelabs/aeo-toolkit` (Vercel team **Advance Labs**), Root Directory `apps/console`.
- **URL:** https://aeo.advancelabs.dev (canonical) · https://aeo-toolkit-ten.vercel.app (Vercel alias)
- **Database:** Supabase, provisioned via the **Vercel Marketplace** (project `axuaeezqdxyhenmpbdnf`),
  connected to Production + Preview, schema applied (`oauth_tokens` + `posts`).
- **Env set:** `TOKEN_ENCRYPTION_KEY`, `OAUTH_STATE_SECRET`, `CRON_SECRET`, `MCP_PUBLIC_URL`,
  `AUDIT_MAX_PAGES`, `BACKLINK_GRAPH_LIMIT`, `SUPABASE_URL` (+ the integration's `SUPABASE_SERVICE_ROLE_KEY`,
  `NEXT_PUBLIC_SUPABASE_URL`, `POSTGRES_*`, …).
- **Working now:** `/tools/audit`, `/tools/eeat`, `/tools/llms-txt`, `/tools/graph`; the human MCP
  connection page at **`/mcp`**; the `ai-visibility` + `backlink` MCP servers (BYOK Perplexity); MCP
  discovery; Supabase-backed token + post storage.
- **Pending creds:** Google OAuth (chat + ga-gsc MCP), LLM keys (blogging cron), Upstash (optional), custom domain.

---

## 1. Deploy the console to Vercel

### Create + configure the project
```bash
# from the repo ROOT (not apps/console — the root is the deploy context for a sub-dir app)
vercel link --yes --scope <team> --project aeo-toolkit
```

Then set the **Root Directory to `apps/console`**. Linking from a subdir does *not* set it, and the
default (repo root) fails with *"No Next.js version detected"*. Set it in the dashboard
(**Settings → General → Root Directory**) or via the API:

```bash
TOKEN=$(sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p' \
  "$HOME/Library/Application Support/com.vercel.cli/auth.json")
curl -X PATCH "https://api.vercel.com/v9/projects/<projectId>?teamId=<teamId>" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"rootDirectory":"apps/console","framework":"nextjs"}'
```

The monorepo install/build is declared in [`apps/console/vercel.json`](../apps/console/vercel.json) — Turbo
builds the `@advance-labs/*` workspace packages (their `dist/`) **before** the Next build, or Next can't resolve them:

```jsonc
{
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "buildCommand": "cd ../.. && pnpm exec turbo run build --filter=@advance-labs/console",
  "crons": [{ "path": "/api/cron/blogging", "schedule": "0 13 * * *" }]
}
```

> **Gotcha — Next.js version:** Vercel **blocks deploys on known-vulnerable Next versions**. Keep `next`
> at a patched release (the repo runs **15.5.x**; `15.1.x` is rejected).

### Set env vars + deploy
```bash
# generate the app secrets (one-time)
openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY
openssl rand -base64 32   # OAUTH_STATE_SECRET
openssl rand -hex 16      # CRON_SECRET

# add each (reads value from stdin); repeat per var, see apps/console/.env.example
printf '%s' "<value>" | vercel env add TOKEN_ENCRYPTION_KEY production

# deploy from the repo ROOT
vercel deploy --prod --yes
```

After the first deploy, set `MCP_PUBLIC_URL` to the live URL and redeploy so MCP `.well-known` discovery
advertises the right origin.

---

## 2. Databases — Vercel Marketplace (`vercel install`)

The **Vercel CLI** provisions a Marketplace database, connects it to the project, **and auto-syncs the env
vars** (the Vercel *MCP server* tools do not — they're for deploy/projects/logs/docs/domains).

```bash
vercel install supabase --name aeo-toolkit -e production -e preview
vercel install neon --name aeo-toolkit-db --plan free -e production -e preview
vercel install upstash/upstash-kv -e production -e preview
vercel integration discover            # list all available providers
```

Marketplace database options for this team:

| Type | Providers (slug) |
|------|------------------|
| Postgres | **Supabase** (`supabase`), **Neon** (`neon`), Prisma Postgres (`prisma/prisma-postgres`), Nile, Amazon Aurora (`aws/aws-apg`, `aws/aws-dsql`) |
| Serverless SQLite | Turso (`tursocloud/database`) |
| Redis / KV | Redis (`redis`), Upstash for Redis (`upstash/upstash-kv`) |
| NoSQL / reactive | DynamoDB (`aws/aws-dynamodb`), Convex (`convex`) |

> **Code compatibility:** `@advance-labs/storage` talks to Supabase via **`@supabase/supabase-js`** (PostgREST +
> service-role key). Supabase drops in with **no code change**. A raw-SQL Postgres (Neon / Prisma) needs a
> small adapter — implement `TokenStore` / `PostStore` (the existing interfaces) against `@neondatabase/serverless`.
> Redis/KV is a natural fit for the token store (get/set/delete by key).

### Supabase specifics (what this deployment uses)
1. `vercel install supabase …` (accept the marketplace terms once, in the browser or
   `vercel integration accept-terms supabase --yes`).
2. **Alias the URL:** the integration syncs `NEXT_PUBLIC_SUPABASE_URL`, but the code reads `SUPABASE_URL` —
   add `SUPABASE_URL` with the same value (`SUPABASE_SERVICE_ROLE_KEY` matches as-is).
3. **Apply the schema** ([`apps/console/supabase/schema.sql`](../apps/console/supabase/schema.sql)) using the
   synced `POSTGRES_URL_NON_POOLING`:
   ```bash
   vercel env pull /tmp/prod.env --environment production --yes
   PG=$(grep -E '^POSTGRES_URL_NON_POOLING=' /tmp/prod.env | cut -d= -f2- | tr -d '"')
   psql "$PG" -f apps/console/supabase/schema.sql        # or paste into the Supabase SQL editor
   rm -f /tmp/prod.env
   ```
   (No `psql`? Use the Supabase dashboard SQL editor, or a one-off Node client with the `postgres` package.)
4. **Redeploy** so the new env applies. Token rows are encrypted at rest via `TOKEN_ENCRYPTION_KEY`; RLS is
   enabled with no permissive policies (service-role only).

---

## 3. Remaining backing services

| Service | Lights up | Env to set |
|---------|-----------|------------|
| ✅ **Supabase** | token persistence + blog store | *(done — see above)* |
| **Google Cloud** OAuth | `/tools/chat`, `ga-gsc` MCP | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=https://<domain>/api/auth/google/callback`; enable GA4 Data API, GA4 Admin API, Search Console API; scopes `analytics.readonly` + `webmasters.readonly` |
| **LLM keys** | blogging cron | `GROQ_API_KEY`, `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`, `GOOGLE_ACCESS_TOKEN`, `GA4_PROPERTY_ID`, `SITE_URL`, `GSC_SITE_URL` |
| **Upstash** (optional) | distributed rate limiting | `vercel install upstash/upstash-kv`, or `UPSTASH_REDIS_REST_URL` + `..._TOKEN` (in-memory fallback otherwise) |
| **Custom domain** | pretty URL | attach in Vercel, then update `MCP_PUBLIC_URL` + the Google redirect |

The blogging agent runs via the **Vercel Cron** in `apps/console/vercel.json` (`/api/cron/blogging`, daily) —
Vercel sends `Authorization: Bearer $CRON_SECRET`, which the route verifies.

---

## 4. Connect MCP servers to Claude

The human-facing connection page is **`https://<domain>/mcp`** — it lists every tool and the exact
connect steps for Claude.ai and Cursor. In **Claude.ai → Settings → Connectors**, add:
- `https://<domain>/api/mcp/ai-visibility`
- `https://<domain>/api/mcp/ga-gsc`
- `https://<domain>/api/mcp/backlink`

OAuth discovery at `/.well-known/*` handles authorization. (A local **stdio** MCP variant for Claude
Desktop isn't part of the Vercel deployment; re-add it later from a thin package over the same tools.)

## 5. Chrome extension

`pnpm --filter @advance-labs/chrome-extension build` → zip `dist/` → upload to the Chrome Web Store (icons are
generated; analysis is 100% local). See `apps/chrome-extension/CHROME_STORE.md`.

## 6. CI / previews

`.github/workflows/ci.yml` gates lint + typecheck + test + build on every push. Connect Vercel's Git
integration for per-PR preview deployments. Secrets live only in Vercel/GitHub env — never in git
(`.env*` and `.vercel` are gitignored).

---

## Becoming a billable SaaS (BUILT — ships dormant)

The commercial layer is **fully built and ships dormant**: Supabase Auth (magic-link), Stripe billing
+ plans, usage metering/quotas on the tool + MCP endpoints, and an account dashboard. With **no new env
set, the site behaves exactly as today** — all five tools free and open, no sign-in, no paywall — so the
code is safe to deploy now. It lights up only when its keys are present (the repo's "lights up when creds
are added" convention, e.g. ga-gsc).

Two independent switches, each derived purely from whether its keys exist (no separate on/off flag):

| Switch | On when… | Unlocks |
|--------|----------|---------|
| `AUTH_ENABLED`    | `NEXT_PUBLIC_SUPABASE_URL` **and** `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set | `/login`, sessions, `/account` |
| `BILLING_ENABLED` | `STRIPE_SECRET_KEY` is set | checkout, the customer portal, plan/quota gating |

Until `BILLING_ENABLED` is true, `checkEntitlement()` returns "allow" for every request, so adding these
keys is the only thing that can ever wall a tool — and unsetting `STRIPE_SECRET_KEY` rolls back instantly.

**Activation runbook (the full, authoritative steps):** see [`ACTIVATION.md`](./ACTIVATION.md). In short:

1. **Apply the billing schema** — `psql "$POSTGRES_URL" -f apps/console/supabase/schema-billing.sql`
   (adds `profiles`, `subscriptions`, `usage_events` with RLS policies + the profile-seeding trigger;
   additive — it does not touch the existing `schema.sql`).
2. **Enable Auth** — set `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the Supabase **anon/publishable** key;
   `NEXT_PUBLIC_SUPABASE_URL` is already set by the Vercel Supabase integration), and add
   `https://aeo.advancelabs.dev/auth/callback` to Supabase's allowed redirect URLs (enable Email magic-link).
3. **Enable Billing** — create a Stripe product + recurring monthly price per paid plan, then set
   `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_AGENCY`.
4. **Webhook** — add a Stripe endpoint at `https://aeo.advancelabs.dev/api/billing/webhook` for
   `checkout.session.completed` + `customer.subscription.{created,updated,deleted}`, and set
   `STRIPE_WEBHOOK_SECRET` to its signing secret (the handler verifies every call's signature).
5. **Tune pricing (optional)** — defaults are Free $0 / Pro $29 / Agency $99 in
   `apps/console/src/lib/billing/plans.ts`; `/pricing` and the gate both read from that one file.

Roll back any time by unsetting `STRIPE_SECRET_KEY` (and the anon key) and redeploying — the schema and
Stripe data are untouched and reactivate the moment the keys return.
