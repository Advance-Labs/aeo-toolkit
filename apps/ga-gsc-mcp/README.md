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
- `GET /authorize` — redirects to Google consent (when OAuth env is set).
- `GET /oauth/callback` — exchanges the code via `GoogleOAuth.exchangeCode` and stores tokens.
- `GET /health` — liveness probe.

## Auth model

Tools resolve a Google access token per call through a `TokenResolver`:

1. a request-scoped BYOK bearer token (if present) — wins, never stored;
2. otherwise a token read from the `TokenStore` (refreshed via `GoogleOAuth.refresh` when expired);
3. otherwise the `GOOGLE_ACCESS_TOKEN` dev fallback;
4. otherwise a typed `no_credentials` error the model can act on.

The default store is `InMemoryTokenStore`. A durable, encrypted **Supabase** adapter is provided as a
typed stub (`SupabaseTokenStore`, marked `// STUB:`) — implement `get`/`set`/`delete` against a
`google_tokens` table with the `refresh_token` column encrypted at rest.

## Env vars

| Var | Required | Purpose |
|-----|----------|---------|
| `GOOGLE_CLIENT_ID` | for OAuth flow | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | for OAuth flow | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | for OAuth flow | must match `${MCP_PUBLIC_URL}/oauth/callback` |
| `MCP_PUBLIC_URL` | hosted | public base URL (used in `.well-known` docs); default `http://localhost:8787` |
| `GOOGLE_ACCESS_TOKEN` | local dev | pre-issued read-only token so tools run without an OAuth round-trip |
| `PORT` | optional | HTTP listen port (default `8787`) |
| `MCP_RATE_CAPACITY` / `MCP_RATE_REFILL_PER_SEC` | optional | token-bucket rate limit (default `30` / `5`) |

## Status

**Implemented:** all seven tool handlers (pure logic unit-tested against a mocked `@aeo/google-api`
client), the stdio (`server.ts`) and HTTP/SSE (`http.ts`) entrypoints sharing one tool registry,
`.well-known` OAuth discovery, the Google OAuth authorize + callback flow (real token exchange via
`@aeo/google-api`), per-request BYOK bearer-token resolution, token refresh, and token-bucket rate
limiting.

**Stubbed (`// STUB:`):** `SupabaseTokenStore` (durable encrypted persistence — uses
`InMemoryTokenStore` until wired), the `state → durable user identity` binding in the OAuth callback
(needs a signed session layer), and — inherited from `@aeo/google-api` — `Ga4Client.listProperties`
(GA4 Admin API). The transport seams in `@aeo/mcp-core` are the SDK wrappers noted in that package.
```
