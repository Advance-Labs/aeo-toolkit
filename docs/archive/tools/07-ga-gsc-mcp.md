> [!WARNING]
> **Archived and historical — this does not describe the current repository.**
> Written before the consolidation in [ADR-0003](../../adr/0003-single-vercel-deployment.md); the `apps/` layout and package list below no
> longer exist. Kept for design history only. See [the archive index](../README.md) for what replaced it.

---

# Tool 7 — GA4 + GSC MCP (`apps/ga-gsc-mcp`)

**Type:** Remote MCP server (Node) · **Deploy:** Vercel Function (HTTP/SSE) + local stdio
**Depends on:** `@advance-labs/mcp-core`, `@advance-labs/google-api`, `@advance-labs/types`

## What it does
Exposes the same GA4 + GSC data as Tool 6 but as structured MCP tools so Claude can invoke them natively
inside Projects and shared threads. One URL pasted into Claude's Connector settings; OAuth auto-discovered.

## Tools
- `list_ga4_properties()` / `list_gsc_sites()`
- `ga4_run_report({ propertyId, dateRanges, dimensions, metrics })`
- `gsc_search_analytics({ siteUrl, startDate, endDate, dimensions })`
- `gsc_top_queries({ siteUrl, days })` / `gsc_ctr_gaps({ siteUrl, days })`
- `compare_periods({ siteUrl, rangeA, rangeB })`

## Server
- `@advance-labs/mcp-core` `createServer` + `registerTool` (zod schemas), `RateLimiter`.
- `.well-known` OAuth discovery (`wellKnownOAuthMetadata` + `wellKnownProtectedResource`) so Claude.ai
  auto-registers credentials. Token persistence via `TokenStore` (`// STUB:` → Supabase adapter).
- Reuses `@advance-labs/google-api` `Ga4Client` / `GscClient` / `GoogleOAuth` — no new Google code.

## Config / env
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `MCP_PUBLIC_URL`.
