> Contributions welcome — see CONTRIBUTING.md.

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logo-dark.svg">
  <img src="brand/logo.svg" alt="AEO Toolkit" width="340">
</picture>

# AEO Toolkit — AI Search Optimization Suite

### Rank in ChatGPT, Claude, Perplexity &amp; AI Overviews

</div>

> Open-source TypeScript monorepo for **Answer Engine Optimization (AEO)**, Generative Engine Optimization (GEO), and AI citation visibility.

**Try it without installing anything:** the five tools run free in the browser at
**[advancelabs.dev/tools](https://advancelabs.dev/tools)** — no sign-up, no account.
Point the auditor at a URL and it returns a weighted, per-rule report in a few seconds.

Those five are the browser tools. The full suite is **nine**: these five, plus three
MCP servers (`ga-gsc`, `backlink`, `ai-visibility`) that plug into Claude or any MCP
client, plus one GitHub Actions content agent ([`@aeo/blogging`](packages/blogging)).

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Made by Advance Labs](https://img.shields.io/badge/Made%20by-Advance%20Labs-7C3AED?style=flat-square)](https://advancelabs.dev)

---

## What is AEO?

**Answer Engine Optimization (AEO)** is the practice of structuring your content so that AI assistants — ChatGPT, Perplexity, Claude, Gemini — cite your site when answering questions in your domain. Traditional SEO gets you ranked on the blue-link results page. AEO gets you *quoted* in the AI answer.

As AI-powered search becomes the default discovery layer, AEO is the new SEO.

---

## Packages

| Package | Description |
|---------|-------------|
| [`@aeo/crawler`](packages/crawler) | Multi-threaded web crawler with robots.txt compliance, sitemap parsing, and per-host rate limiting |
| [`@aeo/html-parser`](packages/html-parser) | Extracts meta tags, Open Graph, Twitter Cards, headings, images, links, and JSON-LD from HTML |
| [`@aeo/schema-validator`](packages/schema-validator) | Validates Schema.org JSON-LD structured data against known types |
| [`@aeo/scoring`](packages/scoring) | Scores pages on 20+ technical SEO and AEO rules — returns a numeric score with per-rule explanations |
| [`@aeo/google-api`](packages/google-api) | Google Search Console + GA4 client — list properties, fetch impressions, submit sitemaps |
| [`@aeo/storage`](packages/storage) | Supabase token store with AES-256-GCM encryption, in-memory and Upstash rate limiters |
| [`@aeo/mcp-core`](packages/mcp-core) | MCP (Model Context Protocol) transport helpers for exposing AEO tools to AI agents |
| [`@aeo/ui`](packages/ui) | React components for rendering AEO audit results — score rings, rule lists, diff views |
| [`@aeo/backlinks`](packages/backlinks) | Backlink graph building and link analysis |
| [`@aeo/llm`](packages/llm) | Provider-agnostic LLM client used by the content audits |
| [`@aeo/pdf`](packages/pdf) | Renders audit reports to PDF |

Plus `blogging`, `net-guard`, `orchestrator`, `types` and `config`. Applications live in
[`apps/console`](apps/console) (the Next.js app behind the hosted tools) and
[`apps/chrome-extension`](apps/chrome-extension).

---

## Quick Start

> **Note:** the `@aeo/*` packages are **not published to npm** yet — they are workspace-internal
> (`private: true`) while the APIs settle. Clone and build to use them; the hosted tools at
> [advancelabs.dev/tools](https://advancelabs.dev/tools) need no install at all.

```bash
git clone https://github.com/Advance-Labs/aeo-toolkit.git
cd aeo-toolkit
pnpm install
pnpm build          # turbo builds every package
pnpm test           # 848 tests
pnpm dev --filter=@aeo/console   # run the console locally
```

Or run the whole console in Docker with no accounts and no keys:

```bash
docker compose up --build   # then open http://localhost:3000
```

See [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) for the full self-hosting guide.

Once built, the packages compose like this:

```ts
import { crawl } from '@aeo/crawler'
import { parseHtml } from '@aeo/html-parser'
import { scorePage } from '@aeo/scoring'

const pages = await crawl('https://example.com')
for (const page of pages) {
  const parsed = parseHtml(page.html)
  const score = scorePage(parsed)
  console.log(page.url, score.total, score.rules)
}
```

---

## Why AEO?

When a user asks ChatGPT "what is the best tool for X?", the answer comes from indexed content that AI models trust — not from ad-auction bidding. The trust signals for AI citation are:

- **Structured data** (JSON-LD `Organization`, `FAQPage`, `HowTo`)
- **`llms.txt`** — the AI equivalent of `robots.txt`
- **Canonical, server-rendered HTML** — AI crawlers prefer static content
- **Topical authority** — consistent, in-depth coverage of a topic

AEO Toolkit automates auditing all of these.

---

## Monorepo Structure

```
aeo-toolkit/
├── packages/          # 16 shared libraries (crawler, parser, scorer, etc.)
├── apps/console/      # Next.js app behind the hosted tools
└── apps/chrome-extension/
```

Built with [Turborepo](https://turbo.build) · TypeScript 5 · Vitest · React 19

---

## Made by Advance Labs

AEO Toolkit is built and maintained by **[Advance Labs Inc.](https://advancelabs.dev)** — a software studio building [Creatin](https://www.creatin.ca), [Cartrix](https://www.cartrix.live), and this toolkit.

This project dogfoods its own tooling: `advancelabs.dev` ships with `llms.txt`, JSON-LD Organization schema, SSG-rendered pages, and canonical URLs — all patterns the scoring engine teaches.

---

## Code of Conduct

We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) — be respectful and constructive in all project spaces, and report unacceptable behavior to [conduct@advancelabs.dev](mailto:conduct@advancelabs.dev).

---

<sub>© 2026 Advance Labs Inc. — <a href="https://advancelabs.dev">advancelabs.dev</a></sub>
