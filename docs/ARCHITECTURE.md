# Architecture

## The reuse thesis

The 9 tools look distinct from the outside but collapse into a small set of shared engines:

```
                       ┌─────────────────────────────────────────┐
                       │            @advance-labs/scoring (keystone)        │
                       │  technicalSeoRules · aeoRules · eeatRules │
                       └───────────────▲───────────────────────────┘
                                       │ consumes
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
   @advance-labs/crawler   @advance-labs/html-parser  @advance-labs/schema-     @advance-labs/pdf      @advance-labs/ui
   (network)      (pure parse)      validator        (reports)     (React)
        │              │             (pure detect)       │            │
        └──────────────┴──────┬──────┴───────────────────┴────────────┘
                              uses
   ┌─────────────┬────────────┴───────────┬──────────────┬───────────────┐
 llm-audit   eeat-scanner          ai-visibility-mcp   chrome-ext   llms-txt-gen
                                          │
                                   @advance-labs/mcp-core ───── ga-gsc-mcp ───── backlink-mcp
                                          │
   @advance-labs/google-api ─── ga-gsc-chat ───────┘        @advance-labs/llm ─── blogging-agent
```

- **Crawl → Parse → Detect → Score** is one pipeline. Build it once in `packages/`, import it in 4 tools.
- **MCP transport + OAuth + rate-limit** is one middleware. Build it once, import it in 3 servers.
- **GA4 + GSC + Google OAuth** is one client package. Import it in 2 tools (chat + MCP) and the agent.
- **BYOK LLM** is one provider-agnostic client. Import it anywhere an AI call happens.

This is the entire economic argument for a monorepo here: the second audit tool costs days, not weeks,
because it reuses the engine the first one paid for.

## Data flow — audit pipeline (tools 1, 2, 4, 5)

```
URL ──▶ @advance-labs/crawler ──▶ pages[] ──▶ @advance-labs/html-parser ──▶ ParsedHtml[]
                                            │
                                            ▼
                                  @advance-labs/schema-validator ──▶ StructuredDataItem[]
                                            │
                                            ▼
                          @advance-labs/scoring (RuleEngine + rule set) ──▶ Score + Finding[]
                                            │
                          ┌─────────────────┼──────────────────┐
                          ▼                 ▼                  ▼
                    @advance-labs/ui (web)     @advance-labs/pdf (export)   MCP tool result
```

## Data flow — data connectors (tools 6, 7, 9)

```
Google OAuth ──▶ @advance-labs/google-api (Ga4Client + GscClient) ──▶ metrics
                                            │
                          ┌─────────────────┼─────────────────┐
                          ▼                 ▼                 ▼
                  ga-gsc-chat        ga-gsc-mcp        blogging-agent
                  (+ @advance-labs/llm)       (@advance-labs/mcp-core)   (+ @advance-labs/llm)
```

## Runtime & deployment

- Node 20+ everywhere; ESM-only packages built with `tsup`.
- Web apps: Next.js App Router on Vercel Fluid Compute (Node runtime, not edge).
- MCP servers: remote HTTP/SSE on Vercel Functions with `.well-known` OAuth discovery; backlink also stdio.
- Extension: fully client-side; audit runs in the browser with zero server calls.

See `ADR/` for the decisions behind these choices.
