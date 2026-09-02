---
title: AEO Toolkit documentation
description: >-
  Documentation for the AEO Toolkit — an open-source TypeScript suite that audits, scores, and
  tracks how AI answer engines cite a website.
---

**Answer Engine Optimization (AEO)** is the practice of structuring content so AI assistants —
ChatGPT, Claude, Perplexity, Gemini — cite your site when answering questions in your domain.
Traditional SEO gets you ranked on the results page. AEO gets you *quoted* in the answer.

This toolkit automates auditing for that. It is MIT-licensed, TypeScript throughout, and runs
entirely on your own infrastructure if you want it to.

## Start here

| If you want to… | Read |
|---|---|
| Understand how the pieces fit | [Architecture](ARCHITECTURE.md) |
| See every tool and its route | [Tool reference](reference/tools.md) |
| Use a package on its own | [Package reference](reference/packages.md) |
| Run the whole thing yourself | [Self-hosting](SELF-HOSTING.md) |
| Deploy it to Vercel | [Deployment](DEPLOYMENT.md) |
| Turn on auth and billing | [Activation runbook](ACTIVATION.md) |
| Contribute code | [Conventions](CONVENTIONS.md) |

## What's in the suite

**Ten tools from two deployables.** Five browser tools (technical audit, E-E-A-T scanner, llms.txt
generator, GA4+GSC chat, 3D backlink graph), three MCP servers exposing 22 tools to Claude and other
MCP clients, one scheduled content agent, and a Chrome extension. All of it is served from a single
Next.js app plus the extension — see [ADR-0003](adr/0003-single-vercel-deployment.md) for why.

Underneath sit **16 packages**, of which six are published to npm. The keystone is
`@advance-labs/scoring`: a weighted rule engine running **54 rules** across technical SEO, AEO, and
E-E-A-T, whose output four separate tool surfaces render.

```bash
git clone https://github.com/Advance-Labs/aeo-toolkit.git
cd aeo-toolkit
pnpm install && pnpm build
pnpm test              # 868 tests
docker compose up      # or run the whole console locally
```

## Background

- [Visibility tracking](VISIBILITY-TRACKING.md) — why an on-page audit is only half a retainer, and
  where the over-time citation tracking lives.
- [SEO + AEO plan](SEO-AEO-PLAN.md) — how the project's own site dogfoods the product.
- [Decisions](adr/0001-monorepo-pnpm-turborepo.md) — the ADRs behind the monorepo, the clean-room
  TypeScript rebuild, and the single-deployment consolidation.

## A note on the archive

[`archive/`](archive/) holds superseded planning documents — the original nine-app build plan, the
per-tool specs, and the managed-tier runbooks. They are kept for design history and are **not**
published to this site. Every file there carries a banner saying so. If you are looking for how the
repository works today, everything above is current; nothing in the archive is.
