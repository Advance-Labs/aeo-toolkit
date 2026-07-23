<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logo-dark.svg">
  <img src="brand/logo.svg" alt="AEO Toolkit" width="340">
</picture>

<h1>AEO Toolkit — AI Search Optimization Suite</h1>

<h3>Rank in ChatGPT, Claude, Perplexity &amp; AI Overviews</h3>

<p>
  <em>Open-source TypeScript monorepo for <strong>Answer Engine Optimization (AEO)</strong>,<br>
  Generative Engine Optimization (GEO), and AI citation visibility.</em>
</p>

<p>
  <a href="https://typescriptlang.org"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white"></a>
  <a href="https://nodejs.org"><img alt="Node" src="https://img.shields.io/badge/Node-%E2%89%A520-339933?style=for-the-badge&logo=node.js&logoColor=white"></a>
  <a href="https://pnpm.io"><img alt="pnpm" src="https://img.shields.io/badge/pnpm-%E2%89%A59-F69220?style=for-the-badge&logo=pnpm&logoColor=white"></a>
  <a href="https://turbo.build"><img alt="Turborepo" src="https://img.shields.io/badge/Turborepo-monorepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white"></a>
</p>

<p>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-22C55E?style=flat-square"></a>
  <a href="CONTRIBUTING.md"><img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-7C3AED?style=flat-square"></a>
  <a href="https://advancelabs.dev"><img alt="Made by Advance Labs" src="https://img.shields.io/badge/Made%20by-Advance%20Labs-0EA5E9?style=flat-square"></a>
</p>

<p>
  <a href="#-what-is-aeo">What is AEO?</a> &nbsp;·&nbsp;
  <a href="#-packages">Packages</a> &nbsp;·&nbsp;
  <a href="#-quick-start">Quick Start</a> &nbsp;·&nbsp;
  <a href="#-why-aeo">Why AEO?</a> &nbsp;·&nbsp;
  <a href="#-monorepo-structure">Structure</a> &nbsp;·&nbsp;
  <a href="#-contributing">Contributing</a>
</p>

</div>

---

## 🤖 What is AEO?

**Answer Engine Optimization (AEO)** is the practice of structuring your content so that AI assistants — ChatGPT, Perplexity, Claude, Gemini — cite your site when answering questions in your domain. Traditional SEO gets you ranked on the blue-link results page. AEO gets you *quoted* in the AI answer.

> 💡 **As AI-powered search becomes the default discovery layer, AEO is the new SEO.**

<table>
<tr>
<td align="center" width="33%">

### 🔎 Crawl
Fetch & parse any site with robots-aware, rate-limited crawling.

</td>
<td align="center" width="33%">

### 📊 Score
Grade pages on 20+ technical SEO & AEO rules with explanations.

</td>
<td align="center" width="33%">

### 🚀 Optimize
Ship `llms.txt`, JSON-LD, and citable, server-rendered content.

</td>
</tr>
</table>

---

## 📦 Packages

| Package | Description |
|---------|-------------|
| 🕷️ [`@aeo/crawler`](packages/crawler) | Multi-threaded web crawler with robots.txt compliance, sitemap parsing, and per-host rate limiting |
| 🧩 [`@aeo/html-parser`](packages/html-parser) | Extracts meta tags, Open Graph, Twitter Cards, headings, images, links, and JSON-LD from HTML |
| ✅ [`@aeo/schema-validator`](packages/schema-validator) | Validates Schema.org JSON-LD structured data against known types |
| 📈 [`@aeo/scoring`](packages/scoring) | Scores pages on 20+ technical SEO and AEO rules — returns a numeric score with per-rule explanations |
| 🔌 [`@aeo/google-api`](packages/google-api) | Google Search Console + GA4 client — list properties, fetch impressions, submit sitemaps |
| 🔐 [`@aeo/storage`](packages/storage) | Supabase token store with AES-256-GCM encryption, in-memory and Upstash rate limiters |
| 🛰️ [`@aeo/mcp-core`](packages/mcp-core) | MCP (Model Context Protocol) transport helpers for exposing AEO tools to AI agents |
| 🎨 [`@aeo/ui`](packages/ui) | 7 React components for rendering AEO audit results — score rings, rule lists, diff views |
| 🧪 [`@aeo/llm-audit`](apps/llm-audit) | Next.js app that runs LLM-powered content audits against the scoring engine |

---

## ⚡ Quick Start

```bash
# Install individual packages
npm install @aeo/crawler @aeo/html-parser @aeo/scoring
```

```ts
// Crawl a site and score every page
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

<details>
<summary><strong>🛠️ Working in the monorepo?</strong> Clone, install, and build from source.</summary>

<br>

```bash
# Requires Node >=20 and pnpm >=9
git clone https://github.com/Advance-Labs/aeo-toolkit.git
cd aeo-toolkit

pnpm install      # install all workspace dependencies
pnpm build        # build every package with Turborepo
pnpm test         # run the Vitest suite
pnpm lint         # lint with ESLint
```

</details>

---

## 🎯 Why AEO?

When a user asks ChatGPT *"what is the best tool for X?"*, the answer comes from indexed content that AI models trust — not from ad-auction bidding. The trust signals for AI citation are:

| Signal | Why it matters |
|--------|----------------|
| 🧱 **Structured data** | JSON-LD `Organization`, `FAQPage`, `HowTo` give models machine-readable facts |
| 🤖 **`llms.txt`** | The AI equivalent of `robots.txt` — tells assistants what to read |
| 📄 **Canonical, server-rendered HTML** | AI crawlers prefer static, canonical content |
| 🏆 **Topical authority** | Consistent, in-depth coverage of a topic builds trust |

**AEO Toolkit automates auditing all of these.**

---

## 🗂️ Monorepo Structure

```text
aeo-toolkit/
├── 📦 packages/          # Shared libraries (crawler, parser, scorer, etc.)
├── 🚀 apps/              # Full applications (llm-audit Next.js app)
└── 🔧 tooling/           # Shared tsconfig, eslint, build configs
```

<div align="center">

Built with **[Turborepo](https://turbo.build)** · **TypeScript 5** · **Vitest** · **React 19**

</div>

---

## 🤝 Contributing

Contributions are welcome! Please read **[CONTRIBUTING.md](CONTRIBUTING.md)** before opening a pull request.

> 🩺 **HEALTHCHECK:** run `pnpm install && pnpm build && pnpm test` to confirm the monorepo is green before opening a PR.

Found a security issue? See our **[Security Policy](SECURITY.md)**.

---

## 🏢 Made by Advance Labs

AEO Toolkit is built and maintained by **[Advance Labs Inc.](https://advancelabs.dev)** — a software studio building [Creatin](https://www.creatin.ca), [Cartrix](https://www.cartrix.live), and this toolkit.

This project dogfoods its own tooling: `advancelabs.dev` ships with `llms.txt`, JSON-LD Organization schema, SSG-rendered pages, and canonical URLs — all patterns the scoring engine teaches.

---

<div align="center">

<sub>📜 Licensed under <a href="LICENSE">MIT</a> &nbsp;·&nbsp; © 2026 Advance Labs Inc. &nbsp;·&nbsp; <a href="https://advancelabs.dev">advancelabs.dev</a></sub>

<br><br>

<sub>⭐ If this toolkit helps you get cited by AI, consider starring the repo.</sub>

</div>
