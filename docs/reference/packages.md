---
title: Package reference
description: >-
  The seven packages in this repo: six published to npm, one workspace-internal config package, and how the dependency graph is shaped.
---

**7 packages.** 6 are published to npm and usable standalone; 1 (`@advance-labs/config`) is
workspace-internal (`"private": true`) shared tooling config. The hosted platform has further
internal packages (Google and Bing clients, MCP kit, PDF renderer, storage and others). They live in a
private repository and are not part of this repo.

Every package is ESM-only, built with `tsup`, tested with Vitest, and extends a shared config from
`@advance-labs/config`.

## Published to npm

```bash
npm i @advance-labs/scoring      # the 44-check audit engine
npm i @advance-labs/net-guard    # SSRF-safe fetch: re-checks every redirect hop
npm i @advance-labs/crawler      # polite crawler with robots.txt + rate limiting
```

| Package | Version | Purpose |
|---|---|---|
| [`@advance-labs/crawler`](../../packages/crawler) | `0.2.4` | Polite, bounded HTTP crawler: sitemap-first discovery, link-following BFS, robots.txt, and site-file detection. |
| [`@advance-labs/html-parser`](../../packages/html-parser) | `0.3.0` | Pure HTML extraction for the AEO Toolkit: meta/OG/Twitter, headings, images, links, content signals, and raw structured-data blocks. No network. |
| [`@advance-labs/net-guard`](../../packages/net-guard) | `0.2.3` | SSRF-guarded HTTP fetch seam: DNS-resolves and rejects private/loopback/link-local/CGNAT/cloud-metadata addresses, re-validates every redirect hop, caps body size and time, and host-pins to defeat DNS rebinding. |
| [`@advance-labs/schema-validator`](../../packages/schema-validator) | `0.2.3` | Detect and validate JSON-LD, Microdata, and RDFa structured data from raw HTML, mapped to schema.org types with AEO-relevant required-property validation. |
| [`@advance-labs/scoring`](../../packages/scoring) | `0.3.1` | Declarative weighted rule engine plus technical-SEO, AEO, and E-E-A-T rule sets and report builders: the keystone scorer of the AEO Toolkit. |
| [`@advance-labs/types`](../../packages/types) | `0.3.0` | Shared domain types for the AEO Toolkit: the single source of truth across all packages. |

## Workspace-internal

| Package | Version | Purpose |
|---|---|---|
| [`@advance-labs/config`](../../packages/config) | `0.1.0` | Shared ESLint, TypeScript, and Prettier configuration for the monorepo. |

## Dependency shape

`types` and `config` sit at the bottom: everything depends on them and they depend on nothing.
`scoring` is the keystone: it consumes `html-parser` and `schema-validator`, and the hosted audit
tools and the Chrome extension render its output.

```
config ─┐
types ──┴─▶ crawler · html-parser · net-guard
                  │
                  ├─▶ schema-validator ─┐
                  │                     ├─▶ scoring ─▶ apps/chrome-extension
                  └─────────────────────┘
```
