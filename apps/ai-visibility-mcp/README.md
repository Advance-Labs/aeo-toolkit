# @aeo/ai-visibility-mcp

A Model Context Protocol (MCP) server for Claude that audits a site's **answer-engine optimization
(AEO)** signals and measures its **AI visibility** by inspecting Perplexity Sonar citations. It runs
locally over **stdio** (Claude Desktop / Cursor) and remotely over **Streamable HTTP** (Claude.ai
connector / Vercel), exposing the same five tools from one registry. Perplexity API keys are
**bring-your-own-key (BYOK)** — supplied per request and never persisted or logged.

## Tools

| Tool | Input | Result |
| --- | --- | --- |
| `analyze_website_aeo` | `{ url }` | Crawls + parses + detects schema, runs `auditScore`, returns an AEO summary (`overall`, `grade`, AEO/structured-data category scores, top fixes), AI-bot access, and crawl-hint file presence. |
| `check_ai_visibility` | `{ prompt, url, perplexityApiKey }` | Queries Perplexity Sonar and inspects `citations[]` → `VisibilityCheck` (`cited`, `citationRank`, `citations`, `model`). |
| `discover_ranking_prompts` | `{ url, topic, perplexityApiKey, testCount? }` | Generates candidate user prompts for the topic via Sonar; optionally live-tests the first few for visibility. |
| `get_visibility_report` | `{ url, prompts, perplexityApiKey }` | Combines the AEO audit with per-prompt visibility checks and an overall citation rate. |
| `compare_competitor_visibility` | `{ prompt, urls, perplexityApiKey }` | One Sonar call ranked across several competitor URLs → `CompetitorVisibility`. |

Every tool returns a human-readable text block plus machine-readable `structuredContent`.

## Architecture

```
tools/index.ts   ── zod input schemas + MCP result shaping (registerTool)
      │
tools/logic.ts   ── dependency-injected core: crawl → parse → schema → auditScore → summarize,
      │              and Perplexity Sonar citation inspection
      │
deps.ts          ── ToolDeps seam: real @aeo/crawler · @aeo/html-parser ·
                     @aeo/schema-validator · @aeo/llm (swapped for fakes in tests)
```

`create-server.ts` builds the shared, rate-limited server (`@aeo/mcp-core#createServer`) and
registers all tools. Both transports reuse it:

- `src/server.ts` — stdio entry (`node dist/server.js`).
- `src/http.ts` — Streamable HTTP entry + `.well-known` OAuth discovery (`node dist/http.js`).
- `api/mcp.ts`, `api/well-known.ts` — Vercel Function adapters delegating to `src/http.ts`.

## Install & run

```bash
pnpm install          # from the monorepo root (the lead runs this centrally)
pnpm --filter @aeo/ai-visibility-mcp build

# Local stdio (Claude Desktop / Cursor):
node dist/server.js

# Self-hosted HTTP (serves /mcp + the two .well-known docs):
node dist/http.js     # listens on $PORT (default 8787)
```

Claude Desktop config snippet:

```jsonc
{
  "mcpServers": {
    "ai-visibility": { "command": "node", "args": ["/abs/path/dist/server.js"] }
  }
}
```

## Environment variables

| Var | Mode | Purpose |
| --- | --- | --- |
| `PORT` | HTTP | Port for the standalone Node HTTP server (default `8787`). |
| `MCP_PUBLIC_URL` | hosted | Public base URL of this server; becomes the protected `resource` and default issuer. |
| `OAUTH_ISSUER` | hosted | OAuth 2.1 authorization-server issuer URL (defaults to `MCP_PUBLIC_URL`). |
| `OAUTH_AUTHORIZATION_SERVERS` | hosted | Comma-separated issuer URLs allowed to mint tokens (defaults to `OAUTH_ISSUER`). |
| `UPSTASH_REDIS_REST_URL` | hosted | Upstash Redis REST URL for distributed per-caller rate limiting. Omit (with the token) to use the in-memory fallback. |
| `UPSTASH_REDIS_REST_TOKEN` | hosted | Upstash Redis REST token. Required alongside the URL to enable the distributed limiter. |

See `.env.example` for the full list. There is **no** `PERPLEXITY_API_KEY` env var: the key is a
per-request tool argument (BYOK) passed straight to `@aeo/llm` and never stored or logged.

## Rate limiting

Two layers guard the server:

1. **In-process token bucket** (`@aeo/mcp-core`) — caps a single process's overall tool throughput;
   exhaustion returns a structured MCP tool error.
2. **Distributed per-caller limit** (`@aeo/storage` `resolveRateLimiter`) — applied at the HTTP entry
   (`src/http.ts#handleMcpRequest`, shared by the standalone server and the Vercel function). Each
   caller key (explicit `mcp-client-id`, else the bearer token, else the originating IP) gets
   `60 requests / 60s`. Over the limit returns **HTTP 429** with a structured
   `{ "error": "rate_limited", "retryAfterSeconds": N }` body and a `Retry-After` header. With
   `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set, the limit holds across stateless
   serverless invocations via an Upstash sliding window; otherwise it falls back to an in-memory
   fixed window (local dev / tests, no secrets needed).

## Status

**Implemented:** all five tools end-to-end — the AEO crawl→parse→schema→`auditScore`→summary
pipeline (real `@aeo/*` packages), Perplexity Sonar visibility checks with citation matching/ranking,
prompt discovery, the combined report, competitor comparison, both transports (stdio + Streamable
HTTP), the `.well-known` OAuth discovery documents, **distributed per-caller rate limiting**
(`@aeo/storage` — Upstash in prod, in-memory fallback), and Vitest coverage of the pure logic +
the rate-limit guard with mocked `@aeo/*`, network, and an injected `RateLimiter`.

**Stubbed (`// STUB:`):** hosted-mode **OAuth token persistence** behind the typed `TokenStore`
seam (`src/token-store.ts`) — an `InMemoryTokenStore` ships for local/test use; a Supabase/KV adapter
is the wiring point for stateless serverless. The Streamable-HTTP transport's SDK option object is
restated minimally inside `@aeo/mcp-core` (documented there), not here.
