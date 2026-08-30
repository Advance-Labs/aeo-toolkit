# ADR 0003 — Single Vercel deployment (the console) + Marketplace database

- **Status:** Accepted
- **Date:** 2026-06-03

## Context
The suite began as 9 independently-deployable apps (5 Next.js web tools, 3 MCP servers, 1 GitHub-Actions
blogging agent) plus a Chrome extension. Running it as a SaaS meant 8 separate Vercel deployments to
manage, with no shared auth/nav/billing surface. We wanted **one Vercel deployment**.

## Decision
Consolidate all HTTP deployables into a single Next.js app, **`apps/console`** (one Vercel project, one
domain):
- each web tool is a route (`/tools/*`) with its API as a route handler;
- the 3 MCP servers are route handlers via the **`mcp-handler`** adapter (`/api/mcp/*` + `/.well-known/*`);
- the blogging agent runs as a **Vercel Cron** (`/api/cron/blogging`), its orchestration lifted into a
  shared `@advance-labs/blogging` package.

The standalone apps were deleted; their logic was preserved in the `@advance-labs/*` packages, so this was
re-homing, not a rewrite. The Chrome extension stays separate (it runs in the browser, shipped via the
Web Store).

For the database, use a **Vercel Marketplace** integration (`vercel install`) rather than a hand-provisioned
external project — it provisions, connects, and syncs env vars in one step. **Supabase** was chosen because
`@advance-labs/storage` already targets `@supabase/supabase-js`, so it needs **no code change**.

## Consequences
- One project, one domain, one env set; a natural home for the future auth + billing layer.
- The shared `@advance-labs/*` engines made consolidation cheap — the apps were always thin wrappers.
- Trade-off: lose independent per-tool deploy/scaling and gain a heavier single build (mitigated by Next
  per-route code-splitting — e.g. three.js only loads on `/tools/graph`).
- Marketplace-Supabase sidesteps the personal free-project cap (Vercel-managed billing) and auto-wires keys.
- Operational gotchas captured in `docs/DEPLOYMENT.md`: set Root Directory to `apps/console` (deploy from
  repo root), Turbo-build the workspace before Next, keep Next ≥ 15.2.x (Vercel blocks vulnerable versions),
  and alias `SUPABASE_URL` (the integration syncs `NEXT_PUBLIC_SUPABASE_URL`).
- A raw-SQL Postgres (Neon/Prisma) or Redis/KV remains a drop-in alternative behind the existing
  `TokenStore` / `PostStore` interfaces if we move off Supabase later.
