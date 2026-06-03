# Architecture

## The reuse thesis

The 9 tools look distinct from the outside but collapse into a small set of shared engines:

```
                       ┌─────────────────────────────────────────┐
                       │            @aeo/scoring (keystone)        │
                       │  technicalSeoRules · aeoRules · eeatRules │
                       └───────────────▲───────────────────────────┘
                                       │ consumes
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
   @aeo/crawler   @aeo/html-parser  @aeo/schema-     @aeo/pdf      @aeo/ui
   (network)      (pure parse)      validator        (reports)     (React)
        │              │             (pure detect)       │            │
        └──────────────┴──────┬──────┴───────────────────┴────────────┘
                              uses
   ┌─────────────┬────────────┴───────────┬──────────────┬───────────────┐
 llm-audit   eeat-scanner          ai-visibility-mcp   chrome-ext   llms-txt-gen
                                          │
                                   @aeo/mcp-core ───── ga-gsc-mcp ───── backlink-mcp
                                          │
   @aeo/google-api ─── ga-gsc-chat ───────┘        @aeo/llm ─── blogging-agent
```

- **Crawl → Parse → Detect → Score** is one pipeline. Build it once in `packages/`, import it in 4 tools.
- **MCP transport + OAuth + rate-limit** is one middleware. Build it once, import it in 3 servers.
- **GA4 + GSC + Google OAuth** is one client package. Import it in 2 tools (chat + MCP) and the agent.
- **BYOK LLM** is one provider-agnostic client. Import it anywhere an AI call happens.

This is the entire economic argument for a monorepo here: the second audit tool costs days, not weeks,
because it reuses the engine the first one paid for.

## Data flow — audit pipeline (tools 1, 2, 4, 5)

```
URL ──▶ @aeo/crawler ──▶ pages[] ──▶ @aeo/html-parser ──▶ ParsedHtml[]
                                            │
                                            ▼
                                  @aeo/schema-validator ──▶ StructuredDataItem[]
                                            │
                                            ▼
                          @aeo/scoring (RuleEngine + rule set) ──▶ Score + Finding[]
                                            │
                          ┌─────────────────┼──────────────────┐
                          ▼                 ▼                  ▼
                    @aeo/ui (web)     @aeo/pdf (export)   MCP tool result
```

## Data flow — data connectors (tools 6, 7, 9)

```
Google OAuth ──▶ @aeo/google-api (Ga4Client + GscClient) ──▶ metrics
                                            │
                          ┌─────────────────┼─────────────────┐
                          ▼                 ▼                 ▼
                  ga-gsc-chat        ga-gsc-mcp        blogging-agent
                  (+ @aeo/llm)       (@aeo/mcp-core)   (+ @aeo/llm)
```

## Runtime & deployment

- Node 20+ everywhere; ESM-only packages built with `tsup`.
- Web apps: Next.js App Router on Vercel Fluid Compute (Node runtime, not edge).
- MCP servers: remote HTTP/SSE on Vercel Functions with `.well-known` OAuth discovery; backlink also stdio.
- Extension: fully client-side; audit runs in the browser with zero server calls.

See `ADR/` for the decisions behind these choices.
