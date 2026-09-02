---
title: Architecture
description: >-
  How ten AEO tools collapse into three shared engines and two deployables, and how data flows through the audit and Google pipelines.
---

## The reuse thesis

Ten tools look distinct from the outside. They collapse into a small set of shared engines, and that
collapse is the entire economic argument for this monorepo: the second audit tool costs days, not
weeks, because it reuses the engine the first one paid for.

Three engines do most of the work:

- **Crawl → parse → detect → score** is one pipeline, built once in `packages/`, used by four tools.
- **MCP transport + OAuth + rate limiting** is one middleware, built once, used by three servers.
- **GA4 + GSC + Google OAuth** is one client, used by the chat tool, the GA-GSC MCP server, and the
  blogging agent.

```
                          ┌──────────────────────────────┐
                          │   @advance-labs/scoring      │  keystone
                          │  technicalSeoRules (29)      │
                          │  aeoRules (11)               │
                          │  eeatRules (14)              │
                          └──────────────┬───────────────┘
                                         │ consumes
        ┌───────────────┬────────────────┼────────────────┬───────────────┐
        │               │                │                │               │
    crawler        html-parser    schema-validator       pdf              ui
   (network)      (pure parse)    (pure detect)       (reports)        (React)
        │               │                │                │               │
        └───────────────┴────────┬───────┴────────────────┴───────────────┘
                                 │ rendered by
        ┌────────────────────────┴────────────────────────┐
        │                                                 │
   apps/console                                  apps/chrome-extension
   ├── /tools/audit  /tools/eeat  /tools/llms-txt         └── single-page mode
   ├── /tools/chat   /tools/graph                             (client-only)
   ├── /api/mcp/{ai-visibility, backlink, ga-gsc}
   └── /api/cron/blogging
                │                    │                  │
           mcp-core            google-api            blogging
                                                     + backlinks
```

## Two deployables

Everything HTTP lives in **one Next.js app**. See
[ADR-0003](adr/0003-single-vercel-deployment.md) for why, and
[`reference/tools.md`](reference/tools.md) for the full route map.

| Deployable | What it is | Target |
|---|---|---|
| `apps/console` | 5 browser tools + 3 MCP servers + 3 crons, one domain, one env set | Vercel (Fluid Compute, Node runtime) |
| `apps/chrome-extension` | MV3 extension, audit runs entirely in the browser | Chrome Web Store |

The three MCP servers are route handlers behind the `mcp-handler` adapter at
`/api/mcp/<slug>/[transport]`, with OAuth 2.1 discovery under `/.well-known/` so Claude.ai can
auto-register them. The blogging agent is a Vercel Cron, not a service.

## Data flow — the audit pipeline

Used by the audit tool, the E-E-A-T scanner, the AI-visibility MCP server, and the extension.

```
URL ─▶ crawler ─▶ CrawledPage[] ─▶ html-parser ─▶ ParsedHtml[]
                                        │
                                        ▼
                              schema-validator ─▶ StructuredDataItem[]
                                        │
                                        ▼
                    scoring (RuleEngine + rule set) ─▶ Score + Finding[]
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 ▼                      ▼                      ▼
              ui (web)              pdf (export)         MCP tool result
```

## Data flow — the Google connectors

Used by the GA4+GSC chat tool, the GA-GSC MCP server, and the blogging agent.

```
Google OAuth ─▶ google-api (Ga4Client + GscClient) ─▶ metrics
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   /tools/chat        /api/mcp/ga-gsc        /api/cron/blogging
   (+ llm, BYOK)      (+ mcp-core)           (+ llm, blogging)
```

## Dormant by default

The console ships with its commercial layer inert. Auth, billing, and the managed tier each derive
their on/off state from whether their environment variables are present — there is no separate
feature flag. With none set, every tool is free and open exactly as it is today.

This is deliberate: adding keys is the only action that can ever wall a tool, and unsetting them
rolls back instantly. See [`ACTIVATION.md`](ACTIVATION.md) for the switches and
[`CONVENTIONS.md`](CONVENTIONS.md#security-invariants) for the invariant that keeps the managed tier
closed-when-dormant rather than open-when-dormant.

## Runtime

- Node 20+ everywhere. ESM-only packages built with `tsup`.
- Next.js App Router on Vercel Fluid Compute — Node runtime, not edge.
- Extension is fully client-side; the only network calls are same-origin site-file fetches.
- All network, clock, and storage I/O is injected, so the whole suite unit-tests with zero network.

See [`adr/`](adr/) for the decisions behind these choices.
