<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logo-dark.png">
  <img src="brand/logo.png" alt="AEO Toolkit" width="360">
</picture>

# AEO Toolkit — AI Search Optimization Suite

### Rank in ChatGPT, Claude, Perplexity &amp; AI Overviews

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-A8F326?style=flat-square&labelColor=0A0A0B)](LICENSE)
[![Made by Advance Labs](https://img.shields.io/badge/Made%20by-Advance%20Labs-7C3AED?style=flat-square&labelColor=0A0A0B)](https://advancelabs.dev)
[![Brand](https://img.shields.io/badge/Brand-guide-B6A4FD?style=flat-square&labelColor=0A0A0B)](brand/README.md)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-AEO%2FGEO_Auditor-A8F326?style=flat-square&logo=googlechrome&logoColor=white&labelColor=0A0A0B)](https://chromewebstore.google.com/detail/aeogeo-auditor/bdkkjpbipgolopjhndknigaaokdabnad)

</div>

> Open-source TypeScript monorepo for **Answer Engine Optimization (AEO)**, Generative Engine Optimization (GEO), and AI citation visibility. Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

**Try it without installing anything:** the five tools run free in the browser at
**[advancelabs.dev/tools](https://advancelabs.dev/tools)** — no sign-up, no account.
Point the auditor at a URL and it returns a weighted, per-rule report in about a minute.

<a href="https://advancelabs.dev/tools"><img src="docs/assets/landing.webp" alt="AEO Toolkit — Your next customer asks an AI. Free, open instruments that measure whether the engines can find, parse, and cite you." width="100%"></a>

Those five are the browser tools. The full suite is **ten**: these five, plus three
MCP servers (`ai-visibility`, `backlink`, `search`) exposing 31 tools to Claude or any MCP
client, plus a scheduled content agent ([`@advance-labs/blogging`](packages/blogging)) and the
[Chrome extension](apps/chrome-extension). See [`docs/reference/tools.md`](docs/reference/tools.md)
for the full map.

---

## What is AEO?

**Answer Engine Optimization (AEO)** is the practice of structuring your content so that AI assistants — ChatGPT, Perplexity, Claude, Gemini — cite your site when answering questions in your domain. Traditional SEO gets you ranked on the blue-link results page. AEO gets you *quoted* in the AI answer.

As AI-powered search becomes the default discovery layer, AEO is the new SEO.

---

## The audit

54 rules across crawlability, AI-bot access, structured data, metadata, answer readiness and
E-E-A-T, run against up to 50 pages, scored out of 100, with a prioritised fix list and templates
for any crawl-hint file you're missing. Free, no account, and your data stays yours.

<img src="docs/assets/audit-tool.webp" alt="The LLM &amp; Technical SEO Audit tool" width="100%">

---

## The Chrome extension

**[AEO/GEO Auditor](https://chromewebstore.google.com/detail/aeogeo-auditor/bdkkjpbipgolopjhndknigaaokdabnad)** puts the same engine on your toolbar. Open any page, click the icon, and get a 0 to 100 AI-readiness score with a letter grade and a list of what to fix. Export it as a PDF.

It runs **40 checks across 9 categories**: the 29 technical-SEO rules plus the 11 AEO rules, which is `auditRules` in [`packages/scoring/src/audit.ts`](packages/scoring/src/audit.ts). The 14 E-E-A-T signals are a separate scorer the extension does not run, which is why this says 40 and the hosted audit above says 54.

Everything happens in your browser. No account, no server, no analytics, no telemetry. The only network requests are to the audited site's own `robots.txt`, `sitemap.xml`, and `llms.txt`, which is what the host permission is for. Nothing is stored, because nothing is sent.

- **Install:** [Chrome Web Store](https://chromewebstore.google.com/detail/aeogeo-auditor/bdkkjpbipgolopjhndknigaaokdabnad)
- **About:** [advancelabs.dev/tools/aeo-auditor](https://advancelabs.dev/tools/aeo-auditor)
- **Source:** [`apps/chrome-extension`](apps/chrome-extension) · [publishing runbook](apps/chrome-extension/CHROME_STORE.md)

Build it yourself:

```bash
pnpm --filter @advance-labs/chrome-extension package
# → apps/chrome-extension/aeo-extension.zip, loadable via chrome://extensions (Developer mode → Load unpacked, on dist/)
```

---

## Packages

| Package | Description |
|---------|-------------|
| [`@advance-labs/crawler`](packages/crawler) | Multi-threaded web crawler with robots.txt compliance, sitemap parsing, and per-host rate limiting |
| [`@advance-labs/html-parser`](packages/html-parser) | Extracts meta tags, Open Graph, Twitter Cards, headings, images, links, and JSON-LD from HTML |
| [`@advance-labs/schema-validator`](packages/schema-validator) | Validates Schema.org JSON-LD structured data against known types |
| [`@advance-labs/scoring`](packages/scoring) | Scores pages on 54 technical SEO, AEO, and E-E-A-T rules — returns a numeric score with per-rule explanations |
| [`@advance-labs/google-api`](packages/google-api) | Google Search Console + GA4 client — list properties, fetch impressions, submit sitemaps |
| [`@advance-labs/storage`](packages/storage) | Supabase token store with AES-256-GCM encryption, in-memory and Upstash rate limiters |
| [`@advance-labs/mcp-core`](packages/mcp-core) | MCP (Model Context Protocol) transport helpers for exposing AEO tools to AI agents |
| [`@advance-labs/ui`](packages/ui) | React components for rendering AEO audit results — score rings, rule lists, diff views |
| [`@advance-labs/backlinks`](packages/backlinks) | Backlink graph building and link analysis |
| [`@advance-labs/llm`](packages/llm) | Provider-agnostic LLM client used by the content audits |
| [`@advance-labs/pdf`](packages/pdf) | Renders audit reports to PDF |

Plus `blogging`, `net-guard`, `orchestrator`, `types` and `config`. Applications live in
[`apps/console`](apps/console) (the Next.js app behind the hosted tools) and
[`apps/chrome-extension`](apps/chrome-extension).

---

## Quick Start

Six packages are published to npm and usable on their own:

```bash
npm i @advance-labs/scoring      # the 54-rule audit engine
npm i @advance-labs/net-guard    # SSRF-safe fetch: re-checks every redirect hop
npm i @advance-labs/crawler      # polite crawler with robots.txt + rate limiting
npm i @advance-labs/html-parser
npm i @advance-labs/schema-validator
npm i @advance-labs/types        # shared types, a dependency of the above
```

> The remaining packages stay workspace-internal (`private: true`) — they are glue for this
> repo rather than things worth supporting standalone. The hosted tools at
> [advancelabs.dev/tools](https://advancelabs.dev/tools) need no install at all.

```bash
git clone https://github.com/Advance-Labs/aeo-toolkit.git
cd aeo-toolkit
pnpm install
pnpm build          # turbo builds every package
pnpm test           # the full suite, no network
pnpm dev --filter=@advance-labs/console   # run the console locally
```

Or run the whole console in Docker with no accounts and no keys:

```bash
docker compose up --build   # then open http://localhost:3000
```

See [`docs/SELF-HOSTING.md`](docs/SELF-HOSTING.md) for the full self-hosting guide, or read the
full documentation at **[docs.advancelabs.dev/aeo-toolkit](https://docs.advancelabs.dev/aeo-toolkit)**.

Once built, the packages compose like this:

```ts
import { crawl } from '@advance-labs/crawler'
import { parseHtml } from '@advance-labs/html-parser'
import { scorePage } from '@advance-labs/scoring'

const pages = await crawl('https://example.com')
for (const page of pages) {
  const parsed = parseHtml(page.html)
  const score = scorePage(parsed)
  console.log(page.url, score.total, score.rules)
}
```

---

## Connect the MCP servers

The three MCP servers are **hosted, not installed**. They are Streamable-HTTP endpoints, so there is
nothing to `npm install` and no local process to run — point any MCP client at the URL.

**Claude Code** — one command per server:

```bash
claude mcp add --transport http --scope user aeo-visibility https://aeo.advancelabs.dev/api/mcp/ai-visibility/mcp
claude mcp add --transport http --scope user aeo-backlink   https://aeo.advancelabs.dev/api/mcp/backlink/mcp
claude mcp add --transport http --scope user aeo-search     https://aeo.advancelabs.dev/api/mcp/search/mcp
```

Drop `--scope user` to register them in the current project only. Check the result with
`claude mcp list`.

**Claude.ai / Claude Desktop** — Settings → Connectors → Add custom connector, then paste the URL.

**Cursor** (`~/.cursor/mcp.json`), Windsurf, or any client that takes a JSON block:

```json
{
  "mcpServers": {
    "aeo-visibility": { "url": "https://aeo.advancelabs.dev/api/mcp/ai-visibility/mcp" },
    "aeo-backlink":   { "url": "https://aeo.advancelabs.dev/api/mcp/backlink/mcp" },
    "aeo-search":     { "url": "https://aeo.advancelabs.dev/api/mcp/search/mcp" }
  }
}
```

| Server | Tools | Credentials |
|---|---|---|
| `aeo-visibility` | 5 | None to connect. Citation checks take a Perplexity key per request. |
| `aeo-backlink` | 7 | None. |
| `aeo-search` | 19 | Sign in with Google: the client opens a browser on first use (in Claude Code, `/mcp` → Authenticate). Or BYOK: a Google access token as `Authorization: Bearer`, plus an optional `x-bing-api-key`. |

Three things that trip people up:

- **The trailing `/mcp` is required.** The bare `/api/mcp/<slug>` returns the adapter's own
  "Not found", which looks like a routing bug and is not.
- **Only `aeo-search` has a login, and its discovery is path-scoped.** It answers an anonymous
  request with a 401 pointing at `/.well-known/oauth-protected-resource/api/mcp/search/mcp`; its
  authorization server is `/api/mcp/oauth`. The ROOT `/.well-known/oauth-*` documents deliberately
  return 404, because `aeo-visibility` and `aeo-backlink` need no login.
- **Every tool is read-only.** None calls a write method on any upstream API.

`/api/mcp/ga-gsc/mcp` still works as a compatibility alias for `aeo-search`; new configs should use
`/api/mcp/search/mcp`.

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
├── apps/chrome-extension/
├── apps/docs/         # Astro + Starlight docs site (renders ../../docs)
├── docs/              # the documentation itself
└── brand/             # the mark, lockups, palette and type (brand/README.md)
```

Built with [Turborepo](https://turbo.build) · TypeScript 5 · Vitest · React 19

---

## Design

The console follows one visual system: a near-black ground, a single acid-green signal
colour, mono lab-sheet labels, Syne headlines, and the Advance Labs sphere as the mark. The
palette, type, tokens and rules are in [`brand/README.md`](brand/README.md), with the assets
beside it. Anything a user sees should follow it, and
[`docs/CONVENTIONS.md`](docs/CONVENTIONS.md#design-and-brand) says how in code.

---

## Made by Advance Labs

AEO Toolkit is built and maintained by **[Advance Labs Inc.](https://advancelabs.dev)** — a software studio building [Creatin](https://www.creatin.ca), [Cartrix](https://www.cartrix.live), and this toolkit.

This project dogfoods its own tooling: `advancelabs.dev` ships with `llms.txt`, JSON-LD Organization schema, SSG-rendered pages, and canonical URLs — all patterns the scoring engine teaches.

---

## Code of Conduct

We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) — be respectful and constructive in all project spaces, and report unacceptable behavior to [conduct@advancelabs.dev](mailto:conduct@advancelabs.dev).

---

<sub>© 2026 Advance Labs Inc. — <a href="https://advancelabs.dev">advancelabs.dev</a></sub>
