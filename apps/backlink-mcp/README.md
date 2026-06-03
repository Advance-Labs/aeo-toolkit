# @aeo/backlink-mcp

A free-source **backlink MCP server** — a no-cost alternative to paid link-index SaaS. It finds
brand mentions, link-building prospects, competitor link sources, and contacts using only free
sources (DuckDuckGo's HTML endpoint, the Wayback Machine CDX API, and direct page fetches), then
drafts personalized outreach emails through your own LLM key (BYOK). Built on
[`@aeo/mcp-core`](../../packages/mcp-core) with token-bucket rate limiting, and exposed over both
**stdio** (Claude Desktop, Cursor) and **HTTP/SSE** (hosted / Vercel) from one shared tool registry.

## Tools

| Tool | Input | What it does |
|------|-------|--------------|
| `find_mentions` | `{ brand, domain?, limit? }` | DuckDuckGo search for a brand; classifies results into linked vs unlinked mentions when a domain is given. |
| `find_prospects` | `{ topic, limitPerAngle? }` | Runs classic link-building footprints (write-for-us, resource pages, roundups) and merges prospects by host. |
| `find_competitor_link_sources` | `{ competitorUrl, limit? }` | Approximates third-party pages linking to a competitor via free DuckDuckGo signals. |
| `verify_page_links` | `{ url, targetDomain }` | Fetches a page (via `@aeo/crawler`) and confirms a link to the target domain, with rel/dofollow detail. |
| `extract_contact_info` | `{ url }` | Extracts emails (incl. `mailto:` and de-obfuscated) and social handles from a page. |
| `check_page_history` | `{ url, limit? }` | Wayback Machine CDX timeline: total snapshots, first/last seen, archive links. |
| `generate_outreach_email` | `{ contact, context, provider, model, apiKey, ... }` | Drafts a short, personalized cold email via `@aeo/llm` (BYOK). |

Every scraping tool **degrades gracefully**: a blocked search, a non-JSON archive response, or a
failed fetch returns an empty result plus a `warnings[]` array — never a thrown error.

## Running

```bash
# Local (stdio) — Claude Desktop / Cursor
pnpm --filter @aeo/backlink-mcp build
node dist/server.js

# Hosted (HTTP/SSE)
node dist/http.js          # POST /mcp ; GET /healthz ; GET /.well-known/oauth-*
```

### Claude Desktop config

```jsonc
{
  "mcpServers": {
    "backlink": { "command": "node", "args": ["/abs/path/to/dist/server.js"] }
  }
}
```

## Environment variables

All optional — the server runs with polite defaults and no credentials.

| Var | Default | Purpose |
|-----|---------|---------|
| `BACKLINK_RATE_CAPACITY` | `8` | Token-bucket capacity (max burst of tool calls). |
| `BACKLINK_RATE_REFILL_PER_SEC` | `1` | Tokens refilled per second — keeps scraping polite. |
| `BACKLINK_USER_AGENT` | honest default UA | Outbound User-Agent (identifies the client honestly). |
| `BACKLINK_REQUEST_TIMEOUT_MS` | `15000` | Per-request network timeout. |
| `PORT` | `3000` | HTTP listen port (`http.js` only). |
| `BACKLINK_PUBLIC_URL` | `http://localhost:PORT` | Public origin for OAuth `.well-known` discovery. |
| `BACKLINK_AUTH_SERVER` | the public origin | External OAuth issuer for protected-resource metadata. |
| `BACKLINK_HTTP_NO_LISTEN` | unset | Set to `1` to import `http.ts` without auto-starting (serverless adapters). |

**BYOK:** `generate_outreach_email` takes the LLM `apiKey` **per request**. It is forwarded to
`@aeo/llm` and is never persisted or logged by this server.

## Status

**Implemented:** all seven tools, the shared rate-limited registry, both transports (stdio +
Streamable HTTP), OAuth 2.1 `.well-known` discovery, pure parsers (DuckDuckGo results, Wayback CDX,
contact extraction, link verification), and outreach prompt shaping over `@aeo/llm`. Vitest suites
cover the pure logic and the tool handlers with mocked `@aeo/*` and network — no live calls.

**Stubbed (`// STUB:`):** the inherently brittle scrape seams — DuckDuckGo result-page selectors and
the Wayback CDX body shape — are wrapped behind adapters, marked in-code, and degrade to
empty + warning rather than throwing. The live network seam (`createLiveHttpClient`) is the single
I/O point; tests inject a fake `HttpClient` to stay network-free.
