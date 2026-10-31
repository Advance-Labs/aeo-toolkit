---
title: Architecture
description: >-
  How the AEO tools collapse into three shared engines and two deployables, and how data flows through the audit and Google pipelines.
---
> **2026-10-20:** `apps/console` and the internal packages it uses moved to a private repository.
> References to them below describe the hosted platform; the code is no longer in this repo.


## The reuse thesis

The tools look distinct from the outside. They collapse into a small set of shared engines, and that
collapse is the entire economic argument for this monorepo: the second audit tool costs days, not
weeks, because it reuses the engine the first one paid for.

Three engines do most of the work:

- **Crawl → parse → detect → score** is one pipeline, built once in `packages/` (this repo), used by
  four hosted tools and the Chrome extension.
- **MCP transport + OAuth + rate limiting** is one middleware, used by three servers (hosted, private).
- **GA4 + GSC + Google OAuth** is one client, used by the chat tool, the search MCP server, and the
  blogging agent (hosted, private).

```
                ┌──────────────────────────────┐
                │   @advance-labs/scoring      │  keystone
                │  technicalSeoRules (31)      │
                │  aeoRules (13)               │
                │  eeatSignalDefs (14)         │
                └──────────────┬───────────────┘
                               │ consumes
        ┌──────────────┬───────┴───────┬──────────────┐
        │              │               │              │
    crawler       html-parser   schema-validator   net-guard
   (network)     (pure parse)    (pure detect)   (SSRF guard)
        │              │               │              │
        └──────────────┴───────┬───────┴──────────────┘
                               │ rendered by
        ┌──────────────────────┴──────────────────────┐
        │                                             │
 apps/chrome-extension (this repo)         hosted platform (private repo)
 └── single-page mode, client-only         ├── 6 browser tools at /tools/*
                                           ├── 3 MCP servers at /api/mcp/*
                                           └── crons (content agent, tracker)
```

## Two deployables

Everything HTTP lives in **one Next.js app**. See
[ADR-0003](adr/0003-single-vercel-deployment.md) for why, and
[`reference/tools.md`](reference/tools.md) for the full route map.

| Deployable | What it is | Target |
|---|---|---|
| `apps/console` (private repo) | 6 browser tools + 3 MCP servers + 3 crons, one domain, one env set | Vercel (Fluid Compute, Node runtime) |
| `apps/chrome-extension` | MV3 extension, audit runs entirely in the browser | Chrome Web Store |

The three MCP servers are route handlers behind the `mcp-handler` adapter at
`/api/mcp/<slug>/[transport]`. `aeo-visibility` and `aeo-backlink` need no sign-in. `aeo-search` uses OAuth 2.1 with Google
consent, and its discovery metadata is scoped to its own path. The root `/.well-known/oauth-*`
documents deliberately 404, so the two keyless servers are never pulled into a login. See [`reference/tools.md`](reference/tools.md) for the details.
The blogging agent is a Vercel Cron, not a service.

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

Hosted platform only (private repo). Used by the GA4+GSC chat tool, the search MCP server, and the
blogging agent.

```
Google OAuth ─▶ google-api (Ga4Client + GscClient) ─▶ metrics
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   /tools/chat        /api/mcp/search        /api/cron/blogging
   (+ llm, BYOK)      (+ mcp-core)           (+ llm, blogging)
```

## Runtime

- Node 20+ everywhere. ESM-only packages built with `tsup`.
- The hosted platform runs Next.js App Router on Vercel Fluid Compute (Node runtime, not edge).
- Extension is fully client-side; the only network calls are same-origin site-file fetches.
- All network, clock, and storage I/O is injected, so the whole suite unit-tests with zero network.

See [`adr/`](adr/) for the decisions behind these choices.
