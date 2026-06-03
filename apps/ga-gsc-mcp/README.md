# @aeo/ga-gsc-mcp

GA4 + Google Search Console exposed to Claude as native **MCP tools**. Paste one URL into Claude's
Connector settings and the model can pull analytics and search-performance data directly inside
Projects and shared threads. The same tool registry runs over **stdio** (Claude Desktop / local)
and over **HTTP/SSE** (hosted on a Vercel Function), with OAuth 2.1 `.well-known` discovery so
Claude.ai auto-registers the connection.

Built entirely on the shared engines — no new Google or transport code:

- [`@aeo/mcp-core`](../../packages/mcp-core) — `createServer` / `registerTool`, `RateLimiter`,
  `wellKnownOAuthMetadata` / `wellKnownProtectedResource`, `mountStdio` / `mountHttp`.
- [`@aeo/google-api`](../../packages/google-api) — `Ga4Client`, `GscClient`, `GoogleOAuth`,
  `InMemoryTokenStore`.
- [`@aeo/storage`](../../packages/storage) — `createSupabaseClient`, `SupabaseTokenStore` (durable,
  AES-256-GCM-encrypted OAuth token persistence).
- [`@aeo/types`](../../packages/types) — shared `Ga4*` / `Gsc*` / `GoogleOAuthTokens` / `TokenStore`.

## Tools

| Tool | Input | Returns |
|------|-------|---------|
| `list_ga4_properties` | — | `{ propertyId, displayName }[]` (GA4 Admin listing is stubbed upstream) |
| `list_gsc_sites` | — | `{ siteUrl, permissionLevel }[]` |
| `ga4_run_report` | `{ propertyId, dateRanges, dimensions, metrics, limit? }` | named rows `{ dimensions, metrics }` |
| `gsc_search_analytics` | `{ siteUrl, startDate, endDate, dimensions, rowLimit? }` | rows `{ keys, clicks, impressions, ctr, position }` |
| `gsc_top_queries` | `{ siteUrl, days, limit }` | top queries by clicks over the last N days |
| `gsc_ctr_gaps` | `{ siteUrl, days, minImpressions, maxCtr, limit }` | high-impression, low-CTR opportunities |
| `compare_periods` | `{ siteUrl, rangeA, rangeB }` | per-period totals + per-metric deltas (clicks, impressions, CTR, weighted position) |

Every tool returns both a readable text summary and a `structuredContent` object for chained calls.

## How to run

```bash
pnpm --filter @aeo/ga-gsc-mcp build

# Local stdio (Claude Desktop):
GOOGLE_ACCESS_TOKEN=ya29... pnpm --filter @aeo/ga-gsc-mcp start   # runs dist/server.js

# Hosted HTTP/SSE (also the Vercel Function entry — dist/http.js):
MCP_PUBLIC_URL=https://mcp.example.com PORT=8787 node dist/http.js
```

### Claude Desktop (stdio) config

```jsonc
{
  "mcpServers": {
    "ga-gsc": {
      "command": "node",
      "args": ["/abs/path/apps/ga-gsc-mcp/dist/server.js"],
      "env": { "GOOGLE_ACCESS_TOKEN": "ya29..." }
    }
  }
}
```

### Hosted connector (HTTP) endpoints

- `POST /mcp` — Streamable HTTP transport (stateless per request). A per-request `Authorization:
  Bearer <google-access-token>` header is honored as a **BYOK** credential (never persisted, never
  logged).
- `GET /.well-known/oauth-authorization-server` and `GET /.well-known/oauth-protected-resource` —
  OAuth 2.1 discovery for Claude.ai auto-registration.
- `GET /authorize` — mints an HMAC-signed `state` binding the user id (default user, or `?user=<id>`
  for multi-tenant front-ends) and redirects to Google consent (when OAuth + `OAUTH_STATE_SECRET` are
  set).
- `GET /oauth/callback` — verifies the signed `state` to derive the user id, exchanges the code via
  `GoogleOAuth.exchangeCode`, and stores tokens under that verified identity.
- `GET /health` — liveness probe.

The hosted entry is deployed as a single Vercel **Node** function (`api/index.ts`) that builds the
runtime once per cold start and delegates to the shared router in `src/http.ts`; `vercel.json`
rewrites every route above to it.

## Auth model

Tools resolve a Google access token per call through a `TokenResolver`:

1. a request-scoped BYOK bearer token (if present) — wins, never stored;
2. otherwise a token read from the `TokenStore` (refreshed via `GoogleOAuth.refresh` when expired);
3. otherwise the `GOOGLE_ACCESS_TOKEN` dev fallback;
4. otherwise a typed `no_credentials` error the model can act on.

The store is **env-gated**: when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set it uses the
durable `@aeo/storage` `SupabaseTokenStore` (multi-instance safe; access/refresh tokens encrypted at
rest with AES-256-GCM when `TOKEN_ENCRYPTION_KEY` is supplied); otherwise it falls back to the
process-local `InMemoryTokenStore` so local dev and tests run with no secrets.

The OAuth `state` parameter is HMAC-SHA256-signed (`OAUTH_STATE_SECRET`) over `userId.timestamp` with
a 10-minute TTL and a timing-safe compare (see `src/state.ts`), so a forged callback cannot write
tokens under another user's identity.

## Env vars

| Var | Required | Purpose |
|-----|----------|---------|
| `GOOGLE_CLIENT_ID` | for OAuth flow | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | for OAuth flow | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | for OAuth flow | must match `${MCP_PUBLIC_URL}/oauth/callback` |
| `MCP_PUBLIC_URL` | hosted | public base URL (used in `.well-known` docs); default `http://localhost:8787` |
| `OAUTH_STATE_SECRET` | hosted OAuth | HMAC secret signing the OAuth `state` (CSRF + identity binding); `/authorize` returns 501 without it |
| `SUPABASE_URL` | durable store | Supabase project URL; with the service-role key, switches the token store from in-memory to Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | durable store | Supabase service-role key (server-only; never logged) |
| `TOKEN_ENCRYPTION_KEY` | optional | passphrase to encrypt OAuth tokens at rest (AES-256-GCM) in the Supabase store |
| `GOOGLE_ACCESS_TOKEN` | local dev | pre-issued read-only token so tools run without an OAuth round-trip |
| `PORT` | optional | HTTP listen port (default `8787`) |
| `MCP_RATE_CAPACITY` / `MCP_RATE_REFILL_PER_SEC` | optional | token-bucket rate limit (default `30` / `5`) |

## Status

**Implemented:** all seven tool handlers (pure logic unit-tested against a mocked `@aeo/google-api`
client), the stdio (`server.ts`) and HTTP/SSE (`http.ts`) entrypoints sharing one tool registry plus
the Vercel Node function (`api/index.ts` + `vercel.json`), `.well-known` OAuth discovery, the Google
OAuth authorize + callback flow with **HMAC-signed `state`** (real token exchange via
`@aeo/google-api`), the env-gated **Supabase** durable/encrypted token store (in-memory fallback),
per-request BYOK bearer-token resolution, token refresh, and token-bucket rate limiting.

**Stubbed:** inherited from `@aeo/google-api`, `Ga4Client.listProperties` (GA4 Admin API). The
transport seams in `@aeo/mcp-core` are the SDK wrappers noted in that package.
```
