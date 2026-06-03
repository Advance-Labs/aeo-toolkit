# Tool 4 — AI Visibility & AEO MCP (`apps/ai-visibility-mcp`)

**Type:** Remote MCP server (Node) · **Deploy:** Vercel Function (HTTP/SSE) + local stdio
**Depends on:** `@aeo/mcp-core`, `@aeo/crawler`, `@aeo/html-parser`, `@aeo/schema-validator`, `@aeo/scoring`, `@aeo/llm`, `@aeo/types`

## What it does
A hosted MCP server for Claude that analyzes AEO signals and checks AI-visibility via Perplexity Sonar
citations. The user supplies their own Perplexity API key (BYOK) for the citation tools.

## Tools
- `analyze_website_aeo({ url })` → crawl + `auditScore` → AEO-focused summary + `Score`.
- `check_ai_visibility({ prompt, url, perplexityApiKey })` → query Perplexity Sonar via `@aeo/llm`,
  inspect `citations[]`, return `VisibilityCheck` (cited? rank? citations).
- `discover_ranking_prompts({ url, topic })` → generate candidate prompts (via `@aeo/llm`) and test a few.
- `get_visibility_report({ url, prompts, perplexityApiKey })` → combine AEO + visibility into one report.
- `compare_competitor_visibility({ prompt, urls, perplexityApiKey })` → run `check_ai_visibility` across
  URLs → ranked `CompetitorVisibility` table.

## Server
- Build on `@aeo/mcp-core`: `createServer`, `registerTool` with zod input schemas, `RateLimiter`,
  structured `toToolError`. Expose `.well-known` OAuth discovery (`wellKnownOAuthMetadata`) for Claude.ai.
- Entry `src/server.ts` (stdio for local) + `api/[transport]/route.ts` or `api/mcp.ts` for Vercel HTTP.

## Config / env
- `PERPLEXITY_*` not stored — keys arrive per-request (BYOK). OAuth client config via env for hosted mode.
- Mark hosted-OAuth token persistence as `// STUB:` behind `TokenStore` (Supabase adapter later).
