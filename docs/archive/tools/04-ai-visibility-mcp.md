> [!WARNING]
> **Archived and historical — this does not describe the current repository.**
> Written before the consolidation in [ADR-0003](../../adr/0003-single-vercel-deployment.md); the `apps/` layout and package list below no
> longer exist. Kept for design history only. See [the archive index](../README.md) for what replaced it.

---

# Tool 4 — AI Visibility & AEO MCP (`apps/ai-visibility-mcp`)

**Type:** Remote MCP server (Node) · **Deploy:** Vercel Function (HTTP/SSE) + local stdio
**Depends on:** `@advance-labs/mcp-core`, `@advance-labs/crawler`, `@advance-labs/html-parser`, `@advance-labs/schema-validator`, `@advance-labs/scoring`, `@advance-labs/llm`, `@advance-labs/types`

## What it does
A hosted MCP server for Claude that analyzes AEO signals and checks AI-visibility via Perplexity Sonar
citations. The user supplies their own Perplexity API key (BYOK) for the citation tools.

## Tools
- `analyze_website_aeo({ url })` → crawl + `auditScore` → AEO-focused summary + `Score`.
- `check_ai_visibility({ prompt, url, perplexityApiKey })` → query Perplexity Sonar via `@advance-labs/llm`,
  inspect `citations[]`, return `VisibilityCheck` (cited? rank? citations).
- `discover_ranking_prompts({ url, topic })` → generate candidate prompts (via `@advance-labs/llm`) and test a few.
- `get_visibility_report({ url, prompts, perplexityApiKey })` → combine AEO + visibility into one report.
- `compare_competitor_visibility({ prompt, urls, perplexityApiKey })` → run `check_ai_visibility` across
  URLs → ranked `CompetitorVisibility` table.

## Server
- Build on `@advance-labs/mcp-core`: `createServer`, `registerTool` with zod input schemas, `RateLimiter`,
  structured `toToolError`. Expose `.well-known` OAuth discovery (`wellKnownOAuthMetadata`) for Claude.ai.
- Entry `src/server.ts` (stdio for local) + `api/[transport]/route.ts` or `api/mcp.ts` for Vercel HTTP.

## Config / env
- `PERPLEXITY_*` not stored — keys arrive per-request (BYOK). OAuth client config via env for hosted mode.
- Mark hosted-OAuth token persistence as `// STUB:` behind `TokenStore` (Supabase adapter later).
