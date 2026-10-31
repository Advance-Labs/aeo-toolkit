---
title: AEO Toolkit documentation
description: >-
  Documentation for the AEO Toolkit — an open-source TypeScript suite that audits, scores, and
  tracks how AI answer engines cite a website.
---

**Answer Engine Optimization (AEO)** is the practice of structuring content so AI assistants —
ChatGPT, Claude, Perplexity, Gemini — cite your site when answering questions in your domain.
Traditional SEO gets you ranked on the results page. AEO gets you *quoted* in the answer.

This toolkit automates auditing for that. The open core in this repo (the audit engine packages, the
Chrome extension and the skills) is Apache-2.0 and TypeScript throughout. The hosted tools at
advancelabs.dev/tools and the three MCP servers are proprietary and not self-hostable.

## Start here

| If you want to… | Read |
|---|---|
| Understand how the pieces fit | [Architecture](ARCHITECTURE.md) |
| See every tool and its route | [Tool reference](reference/tools.md) |
| Use a package on its own | [Package reference](reference/packages.md) |
| Contribute code | [Conventions](CONVENTIONS.md) |

## What's in the suite

**Hosted (proprietary).** Six browser tools (technical audit, E-E-A-T scanner, llms.txt generator,
GA4+GSC chat, backlink graph, authority) and three MCP servers exposing 31 tools to Claude and other
MCP clients. They run on advancelabs.dev and their code lives in a private repository.

**Open core (this repo).** Six packages published to npm, the Chrome extension and the skills. The
keystone is `@advance-labs/scoring`: a weighted rule engine whose audit runs **44 checks** (31
technical SEO + 13 AEO). The E-E-A-T scan is a separate scorer with **14 signals**; the engine
defines 58 in total.

```bash
git clone https://github.com/Advance-Labs/aeo-toolkit.git
cd aeo-toolkit
pnpm install && pnpm build
pnpm test
```

## Background

- [Visibility tracking](VISIBILITY-TRACKING.md) — why an on-page audit is only half the picture, and
  where the over-time citation tracking lives.
- [Decisions](adr/0001-monorepo-pnpm-turborepo.md) — the ADRs behind the monorepo, the clean-room
  TypeScript rebuild, and the single-deployment consolidation.

## A note on the archive

`archive/` holds superseded planning documents — the original nine-app build plan, the
per-tool specs, and the managed-tier runbooks. They are kept for design history and are **not**
published to this site. Every file there carries a banner saying so. If you are looking for how the
repository works today, everything above is current; nothing in the archive is.
