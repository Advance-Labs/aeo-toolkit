<p align="center"><img src="../../brand/logo.svg" alt="AEO Toolkit" width="280"></p>

# @aeo/ga-gsc-chat

> Ask natural-language SEO questions grounded in your own GA4 + Google Search Console data, answered by your own LLM key (BYOK).

Tool 6 — **GA4 + Google Search Console Chat**. A Next.js 15 (App Router) app that connects a user's
Google Analytics 4 property and verified Search Console site over read-only OAuth, then answers
natural-language SEO questions grounded in that real data. The user brings their **own** LLM key
(BYOK: Anthropic, OpenAI, Groq, Perplexity, or the Vercel AI Gateway). The app fetches GA4 + GSC,
compresses the results into a compact data context, and asks the chosen model for a numbered,
data-grounded fix list — it never invents metrics.

Built on the shared engines: `@aeo/google-api` (OAuth + GA4 + GSC clients), `@aeo/llm` (BYOK
completion), `@aeo/ui` (layout shell), and `@aeo/types` (shared shapes).

## How to run

```bash
# from the monorepo root, after the central install
pnpm --filter @aeo/ga-gsc-chat dev      # http://localhost:3000
pnpm --filter @aeo/ga-gsc-chat build
pnpm --filter @aeo/ga-gsc-chat start
pnpm --filter @aeo/ga-gsc-chat typecheck
pnpm --filter @aeo/ga-gsc-chat test
```

Copy `.env.example` to `.env.local` and fill in the Google OAuth credentials first.

### Using the app

1. **Connect Google** — read-only GA4 + Search Console consent.
2. **Pick data sources** — choose a Search Console site (live list) and enter/select a GA4 property
   ID. (GA4 property listing is stubbed upstream, so property entry is manual.)
3. **Bring your own LLM key** — pick a provider + model and paste your API key. The key is sent only
   with the request; it is never stored server-side.
4. **Ask** — use a preset card (CTR gaps, impression declines, engagement, device/country) or type a
   free-form question.

## Routes / entrypoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | page | Connect button, site/property pickers, BYOK settings, preset cards, chat thread. |
| `/api/auth/google` | GET | Start OAuth — sets a session-id + CSRF-state cookie, redirects to Google consent. |
| `/api/auth/google/callback` | GET | Verify CSRF state, exchange code, persist tokens via `TokenStore`. |
| `/api/connection` | GET | Report connection status; list GSC sites (live) and GA4 properties (stub). |
| `/api/chat` | POST | `{ question, propertyId, siteUrl, llmProvider, model, apiKey }` → fetch GA4 + GSC → build context → `@aeo/llm` `complete()` → grounded answer. |

All route handlers run on the **Node runtime** (`export const runtime = 'nodejs'`), not edge.

## Environment variables

| Var | Required | Description |
|-----|----------|-------------|
| `GOOGLE_CLIENT_ID` | yes | Google OAuth web client id. |
| `GOOGLE_CLIENT_SECRET` | yes | Google OAuth web client secret. |
| `GOOGLE_REDIRECT_URI` | yes | Must match `/api/auth/google/callback` and the Cloud Console redirect URI. |
| `SUPABASE_URL` | prod | Supabase project URL. Enables durable token storage when set with the service-role key. |
| `SUPABASE_SERVICE_ROLE_KEY` | prod | Supabase service-role key (server-only). Required alongside `SUPABASE_URL` to use the Supabase store. |
| `TOKEN_ENCRYPTION_KEY` | prod | Passphrase for AES-256-GCM encryption of OAuth tokens at rest. Strongly recommended whenever Supabase is configured. |

Token storage is **env-gated**: when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both
present, `getTokenStore()` returns the encrypted Supabase-backed store from `@aeo/storage`;
otherwise it falls back to the in-memory dev store, so local dev and tests run with no secrets.

The user's **LLM API key is never an env var** — it is request-scoped BYOK and is never persisted or
logged server-side.

## Deploy

Deploy on Vercel with this app as the **project root directory** (`apps/ga-gsc-chat`). A
[`vercel.json`](./vercel.json) pins `framework: "nextjs"`; the monorepo install/build is handled by
the root Turborepo config.

1. **Import the repo** in Vercel and set the project **Root Directory** to `apps/ga-gsc-chat`.
2. **Set environment variables** (Production + Preview): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REDIRECT_URI` (use the deployed origin, e.g.
   `https://your-app.vercel.app/api/auth/google/callback`, and add it as an authorized redirect URI
   in the Google Cloud Console), plus `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `TOKEN_ENCRYPTION_KEY` so refresh tokens persist (encrypted) across serverless instances.
3. **Provision the `oauth_tokens` table** in Supabase per the `@aeo/storage` schema (`user_id` text
   PK, `access_token` text, `refresh_token` text null, `expires_at` bigint, `scope` text).
4. **Deploy.** Without the Supabase vars the app still runs, but tokens live in per-instance memory
   and will not survive a cold start or scale-out — set them for any real deployment.

## Status

**Implemented:** OAuth start + callback (CSRF-protected) via `@aeo/google-api` `GoogleOAuth`;
per-request access-token refresh; durable, env-gated token persistence (Supabase-backed +
encrypted via `@aeo/storage`, in-memory fallback for dev); `/api/connection` GSC site listing;
`/api/chat` GA4 `runReport` + GSC `query` → compact data context → `@aeo/llm` `complete()`; the full
home UI (connect, pickers, BYOK settings, preset cards, chat thread). Pure logic (data-context
formatting, prompt building, request validation, date windows), the token-store factory selection,
and the orchestrator are covered by Vitest with `@aeo/*` and network fully mocked.

`getTokenStore()` (in `src/lib/token-store.ts`) returns the encrypted `SupabaseTokenStore` from
`@aeo/storage` when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set (with
`TOKEN_ENCRYPTION_KEY` enabling AES-256-GCM at rest), and the `InMemoryTokenStore` from
`@aeo/google-api` otherwise. Both satisfy the same `@aeo/types` `TokenStore` contract, so the OAuth
routes are unchanged.

**Stubbed (typed seams, marked `// STUB:`):**

- **GA4 property listing** — `Ga4Client.listProperties()` is a stub in `@aeo/google-api` (returns
  `[]` pending the GA4 Admin API), so the UI falls back to manual property-id entry.
