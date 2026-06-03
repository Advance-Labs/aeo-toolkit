# Deployment

The suite deploys as **one Vercel project** (`apps/console`) plus the Chrome extension (built from the
repo, shipped via the Web Store). One domain, one env set.

| Piece | Target | How |
|-------|--------|-----|
| `apps/console` — all tools + MCP + blogging cron | **Vercel** (one project) | Root Directory = `apps/console`, framework Next.js, install at repo root with pnpm |
| `apps/chrome-extension` | Chrome Web Store | `pnpm --filter @aeo/chrome-extension build` → zip `dist/` → upload |

## 1. Provision backing services

| Service | Used by | Gives you |
|---------|---------|-----------|
| **Supabase** (Postgres) | `/tools/chat`, `/api/mcp/ga-gsc`, blogging cron | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; tables `oauth_tokens` + `posts` |
| **Upstash Redis** | audit + MCP rate limiting | `UPSTASH_REDIS_REST_URL` + `..._TOKEN` (falls back to in-memory if unset) |
| **Google Cloud** OAuth | GA4 + Search Console tools/MCP, blogging | OAuth web client (`GOOGLE_CLIENT_ID/SECRET`); enable GA4 Data API, GA4 Admin API, Search Console API; scopes `analytics.readonly` + `webmasters.readonly` |
| **Groq + Anthropic/OpenAI** | blogging cron | model keys (other LLM use is BYOK — passed per request) |

Generate two secrets: `TOKEN_ENCRYPTION_KEY` and `OAUTH_STATE_SECRET` (`openssl rand -base64 32`), plus a
`CRON_SECRET` for the blogging cron.

## 2. Deploy the console to Vercel

1. New Vercel project from the repo → **Root Directory = `apps/console`** (Vercel detects the pnpm workspace + Next.js).
2. Set the env vars from [`../apps/console/.env.example`](../apps/console/.env.example) — one set covers the whole suite:
   - `MCP_PUBLIC_URL` (this deployment's URL), `GOOGLE_*` (`GOOGLE_REDIRECT_URI` = `<url>/api/auth/google/callback`),
     `SUPABASE_*`, `TOKEN_ENCRYPTION_KEY`, `OAUTH_STATE_SECRET`, `UPSTASH_*`, `AUDIT_MAX_PAGES`, `BACKLINK_GRAPH_LIMIT`,
     and the blogging-cron vars (`CRON_SECRET`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`, `GOOGLE_ACCESS_TOKEN`, `GA4_PROPERTY_ID`, `SITE_URL`, `GSC_SITE_URL`, optional `PUBLISH_WEBHOOK_URL`/`DEPLOY_HOOK_URL`).
3. Deploy. Then set `MCP_PUBLIC_URL` to the real URL and redeploy so the MCP `.well-known` discovery advertises the right origin.
4. Add your custom domain.

The blogging agent runs automatically via the **Vercel Cron** declared in `apps/console/vercel.json`
(`/api/cron/blogging`, daily) — Vercel sends `Authorization: Bearer $CRON_SECRET`, which the route verifies.

## 3. Connect MCP servers to Claude

In **Claude.ai → Settings → Connectors**, add:
- `https://<your-domain>/api/mcp/ai-visibility`
- `https://<your-domain>/api/mcp/ga-gsc`
- `https://<your-domain>/api/mcp/backlink`

OAuth discovery at `/.well-known/*` handles authorization. (A local **stdio** MCP variant for Claude
Desktop is not part of the Vercel deployment; re-add it later from a thin package over the same tools.)

## 4. Chrome extension

`pnpm --filter @aeo/chrome-extension build` → zip `dist/` → upload to the Chrome Web Store (icons are
generated; analysis is 100% local). See `apps/chrome-extension/CHROME_STORE.md`.

## 5. CI / previews

`.github/workflows/ci.yml` gates lint + typecheck + test + build on every push. Connect Vercel's Git
integration for per-PR preview deployments. Secrets live only in Vercel/GitHub env — never in git
(`.env*` is gitignored).

## Becoming a billable SaaS (not yet built)

The console is the surface; a commercial product still needs **auth** (Supabase Auth), **Stripe** billing
+ plans, **usage metering/quotas** on the audit/visibility endpoints, and an **account dashboard**.
