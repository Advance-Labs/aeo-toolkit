# AEO Toolkit — AI Search Optimization Suite

> Open-source 9-package TypeScript monorepo for **Answer Engine Optimization (AEO)**, Generative Engine Optimization (GEO), and AI citation visibility.

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
| [`@aeo/ui`](packages/ui) | 7 React components for rendering AEO audit results — score rings, rule lists, diff views |
| [`@aeo/llm-audit`](apps/llm-audit) | Next.js app that runs LLM-powered content audits against the scoring engine |

---

## Quick Start

```bash
# Install individual packages
npm install @aeo/crawler @aeo/html-parser @aeo/scoring

# Crawl a site and score every page
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
├── packages/          # Shared libraries (crawler, parser, scorer, etc.)
├── apps/              # Full applications (llm-audit Next.js app)
└── tooling/           # Shared tsconfig, eslint, build configs
```

Built with [Turborepo](https://turbo.build) · TypeScript 5 · Vitest · React 19

---

## Made by Advance Labs

AEO Toolkit is built and maintained by **[Advance Labs Inc.](https://advancelabs.dev)** — a software studio building [Creatin](https://www.creatin.ca), [Cartrix](https://www.cartrix.live), and this toolkit.

This project dogfoods its own tooling: `advancelabs.dev` ships with `llms.txt`, JSON-LD Organization schema, SSG-rendered pages, and canonical URLs — all patterns the scoring engine teaches.

---

<sub>© 2026 Advance Labs Inc. — <a href="https://advancelabs.dev">advancelabs.dev</a></sub>
