> [!WARNING]
> **Archived and historical — this does not describe the current repository.**
> Written before the consolidation in [ADR-0003](../../adr/0003-single-vercel-deployment.md); the `apps/` layout and package list below no
> longer exist. Kept for design history only. See [the archive index](../README.md) for what replaced it.

---

# Tool 8 — Backlink MCP (`apps/backlink-mcp`)

**Type:** stdio + remote MCP server (Node) · **Deploy:** npm (stdio, Claude Desktop/Cursor) + Vercel (remote)
**Depends on:** `@advance-labs/mcp-core`, `@advance-labs/llm`, `@advance-labs/crawler` (for fetch/verify), `@advance-labs/types`

## What it does
A free alternative to paid link-index SaaS. Finds brand mentions, prospects, and contacts using free
sources (DuckDuckGo HTML, Wayback CDX, direct fetches), with polite rate limiting.

## Tools
- `find_mentions({ brand, domain? })` — linked/unlinked mentions via DuckDuckGo HTML results.
- `find_prospects({ topic })` — guest-post / resource-page angles.
- `find_competitor_link_sources({ competitorUrl })`.
- `verify_page_links({ url, targetDomain })` — fetch + confirm link presence/attributes.
- `extract_contact_info({ url })` — emails + social handles from a page.
- `check_page_history({ url })` — Wayback CDX timeline.
- `generate_outreach_email({ contact, context })` — pipes contact info + context through `@advance-labs/llm` (BYOK).

## Server
- `@advance-labs/mcp-core` with a configurable `rate_limit` (token bucket — DuckDuckGo blocks aggressive scraping).
- Provide both `src/server.ts` (stdio) and a Vercel HTTP entry (remote variant).

## Notes / stubs
- DuckDuckGo/Wayback parsing is brittle by nature — wrap each source behind an adapter; mark fragile
  selectors with `// STUB:` and degrade gracefully (return empty + a warning, never throw).
- Respect robots and rate limits; identify the client honestly.
