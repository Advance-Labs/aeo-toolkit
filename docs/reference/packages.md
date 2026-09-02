---
title: Package reference
description: >-
  All 16 packages: which six are published to npm, which ten are workspace-internal, and how the dependency graph is shaped.
---

**16 packages.** 6 are published to npm and usable standalone; 10 are
workspace-internal (`"private": true`) — glue for this repo rather than things worth supporting on
their own.

Every package is ESM-only, built with `tsup`, tested with Vitest, and extends a shared config from
`@advance-labs/config`.

## Published to npm

```bash
npm i @advance-labs/scoring      # the 54-rule audit engine
npm i @advance-labs/net-guard    # SSRF-safe fetch: re-checks every redirect hop
npm i @advance-labs/crawler      # polite crawler with robots.txt + rate limiting
```

| Package | Version | Purpose |
|---|---|---|
| [`@advance-labs/crawler`](../../packages/crawler) | `0.2.0` | Polite, bounded HTTP crawler — sitemap-first discovery, link-following BFS, robots.txt, and site-file detection. |
| [`@advance-labs/html-parser`](../../packages/html-parser) | `0.2.0` | Pure HTML extraction for the AEO Toolkit — meta/OG/Twitter, headings, images, links, content signals, and raw structured-data blocks. No network. |
| [`@advance-labs/net-guard`](../../packages/net-guard) | `0.2.0` | SSRF-guarded HTTP fetch seam — DNS-resolves and rejects private/loopback/link-local/CGNAT/cloud-metadata addresses, re-validates every redirect hop, caps body size and time, and host-pins to defeat DNS rebinding. |
| [`@advance-labs/schema-validator`](../../packages/schema-validator) | `0.2.0` | Detect and validate JSON-LD, Microdata, and RDFa structured data from raw HTML, mapped to schema.org types with AEO-relevant required-property validation. |
| [`@advance-labs/scoring`](../../packages/scoring) | `0.2.0` | Declarative weighted rule engine plus technical-SEO, AEO, and E-E-A-T rule sets and report builders — the keystone scorer of the AEO Toolkit. |
| [`@advance-labs/types`](../../packages/types) | `0.2.0` | Shared domain types for the AEO Toolkit — the single source of truth across all packages. |

## Workspace-internal

| Package | Version | Purpose |
|---|---|---|
| [`@advance-labs/backlinks`](../../packages/backlinks) | `0.1.1` | Free-source backlink engine — DuckDuckGo / CommonCrawl / Wayback providers, contact extraction, a rate-limited HTTP seam, and a backlink graph builder. |
| [`@advance-labs/blogging`](../../packages/blogging) | `0.1.1` | Autonomous multi-agent blogging pipeline: research GSC query gaps, draft with Groq, edit, dedup via Jaccard fingerprints, schedule, publish, and self-correct underperformers. Built on @advance-labs/google-api and @advance-labs/llm (BYOK). All I/O is injected, so it is fully testable with no network. |
| [`@advance-labs/config`](../../packages/config) | `0.1.0` | Shared ESLint, TypeScript, and Prettier configuration for the AEO Toolkit monorepo. |
| [`@advance-labs/google-api`](../../packages/google-api) | `0.1.1` | GA4 Data API + Search Console clients and Google OAuth for the AEO Toolkit. Uses injectable global fetch (no heavy googleapis dependency). |
| [`@advance-labs/llm`](../../packages/llm) | `0.1.1` | Provider-agnostic BYOK LLM client (Anthropic, OpenAI, Groq, Perplexity, Vercel AI Gateway) with an injectable fetcher. |
| [`@advance-labs/mcp-core`](../../packages/mcp-core) | `0.1.1` | Shared MCP server kit for the AEO Toolkit: transports, OAuth 2.1 discovery, token-bucket rate limiting, tool registry, and structured errors — built on @modelcontextprotocol/sdk. |
| [`@advance-labs/orchestrator`](../../packages/orchestrator) | `0.1.1` | Autopilot v1 managed-layer spine: per-customer cadence, an idempotent proposal store, the content + outreach runners (composed from @advance-labs/blogging and @advance-labs/backlinks), the graduated auto-publish gate, and runCadence. All I/O is injected, so it is fully testable with no network. |
| [`@advance-labs/pdf`](../../packages/pdf) | `0.1.1` | Server-side PDF audit report renderer for the AEO Toolkit, built on @react-pdf/renderer. |
| [`@advance-labs/storage`](../../packages/storage) | `0.1.1` | Production storage and rate-limit adapters — Supabase-backed encrypted token store plus in-memory and Upstash rate limiters, behind small injectable seams. |
| [`@advance-labs/ui`](../../packages/ui) | `0.1.1` | Shared React design-system components for the AEO Toolkit web apps. Presentational, Tailwind-class based, headless-friendly. |

## Dependency shape

`types` and `config` sit at the bottom — everything depends on them and they depend on nothing.
`scoring` is the keystone: it consumes `html-parser` and `schema-validator`, and four tool surfaces
render its output. Consolidating the apps did not change this graph, which is why
[ADR-0003](../adr/0003-single-vercel-deployment.md) was cheap to execute.

```
config ─┐
types ──┴─▶ crawler · html-parser · llm · pdf · ui · mcp-core · google-api · net-guard
                  │
                  ├─▶ schema-validator ─┐
                  │                     ├─▶ scoring ─┐
                  └─────────────────────┘            │
                                                     ├─▶ apps/console
            backlinks · blogging · orchestrator · storage
                                                     └─▶ apps/chrome-extension
```
