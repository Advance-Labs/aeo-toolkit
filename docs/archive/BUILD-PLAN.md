> [!WARNING]
> **Archived and historical — this does not describe the current repository.**
> Written before the consolidation in [ADR-0003](../adr/0003-single-vercel-deployment.md); the `apps/` layout and package list below no
> longer exist. Kept for design history only. See [the archive index](README.md) for what replaced it.

---

# AEO Toolkit — Detailed Build Plan

> Open-source rebuild of the 9 SellOnLLM free tools as a single TypeScript-first
> monorepo owned by **Advance Labs Inc.** Built clean-room from scratch, using the
> referenced OSS projects only as architectural references (no AGPL contamination).

---

## 1. Goals & Non-Goals

**Goals**

- Reproduce all **9 tools** (technical SEO audit, E-E-A-T scanner, llms.txt generator,
  AI-visibility MCP, Chrome extension, GA+GSC chat, GA+GSC MCP, backlink MCP, blogging agent).
- Maximize code reuse: the crawl → parse → score pipeline is built **once** and shared by 4 tools;
  the MCP transport/auth middleware is built **once** and shared by 3 tools.
- TypeScript everywhere. One toolchain (pnpm + Turborepo + Vitest + ESLint + Prettier).
- BYOK (bring-your-own-key) for all paid APIs — the toolkit never ships or bills for third-party keys.
- Every package and app self-documents (`README.md`) and is independently testable and deployable.

**Non-Goals**

- We do not fork Go/Python/Java codebases. We reference their behavior and rebuild in TS.
- We do not host or proxy users' LLM / Perplexity / Google credentials beyond encrypted OAuth refresh tokens.
- We do not ship secrets. All keys come from environment variables or per-request BYOK.

---

## 2. Repository Topology

```
aeo-toolkit/
├── packages/                 # shared, versioned libraries (the reuse layer)
│   ├── config/      @advance-labs/config            # eslint / tsconfig / prettier presets
│   ├── types/       @advance-labs/types             # shared domain types (single source of truth)
│   ├── crawler/     @advance-labs/crawler           # polite HTTP crawler: sitemap, link-follow, robots.txt
│   ├── html-parser/ @advance-labs/html-parser       # meta/OG/Twitter, headings, alts, links, structured-data extract
│   ├── schema-validator/ @advance-labs/schema-validator  # JSON-LD / Microdata / RDFa detection + schema.org validation
│   ├── scoring/     @advance-labs/scoring           # weighted rule engine: technical-SEO + AEO + E-E-A-T scorers
│   ├── mcp-core/    @advance-labs/mcp-core          # MCP server kit: transport, OAuth, logging, rate-limit middleware
│   ├── google-api/  @advance-labs/google-api        # GA4 Data API + Search Console API clients + unified OAuth
│   ├── llm/         @advance-labs/llm               # provider-agnostic BYOK LLM client (Anthropic/OpenAI/Groq)
│   ├── pdf/         @advance-labs/pdf               # PDF report renderer (shared by audit web app + extension)
│   └── ui/          @advance-labs/ui                # shared React design system (ScoreGauge, FixList, layout)
│
├── apps/                     # the 9 tools (1 package each, independently deployable)
│   ├── llm-audit/            # Tool 1  — Next.js: 50-page technical+AEO audit, scored, PDF export
│   ├── eeat-scanner/         # Tool 2  — Next.js: 12-page E-E-A-T pillar scoring
│   ├── llms-txt-generator/   # Tool 3  — Next.js: crawl → llms.txt / llms-full.txt manifest
│   ├── ai-visibility-mcp/    # Tool 4  — Remote MCP server (Vercel): AEO + Perplexity citation checks
│   ├── chrome-extension/     # Tool 5  — MV3 extension: single-page real-time AI-readiness audit
│   ├── ga-gsc-chat/          # Tool 6  — Next.js: NL chat grounded in GA4 + GSC data (BYOK LLM)
│   ├── ga-gsc-mcp/           # Tool 7  — Remote MCP server: GA4 + GSC tools for Claude
│   ├── backlink-mcp/         # Tool 8  — stdio + remote MCP: mentions, prospects, contact extraction
│   └── blogging-agent/       # Tool 9  — multi-agent content pipeline on GitHub Actions
│
├── docs/                     # architecture, conventions, ADRs, per-tool specs
└── .github/workflows/        # CI (lint/typecheck/test/build) + release (changesets)
```

### 2.1 Internal dependency graph (build order)

```
config ─┐
types ──┴─▶ crawler ──┐
            html-parser ──┬─▶ schema-validator ──┐
            llm           │                       ├─▶ scoring ──┐
            pdf           │                       │             │
            ui            │                       │             ▼
            mcp-core      │                       │      ┌──────────────── apps ────────────────┐
            google-api ───┘                       │      │ llm-audit, eeat-scanner,             │
                                                  └──────│ chrome-extension, ai-visibility-mcp  │
                                                         │ llms-txt-generator, ga-gsc-chat,     │
                                                         │ ga-gsc-mcp, backlink-mcp,            │
                                                         │ blogging-agent                       │
                                                         └──────────────────────────────────────┘
```

**Keystone package:** `@advance-labs/scoring`. Four tools render its output. Its public API (the
`Score`, `ScoreCategory`, `Finding` shapes in `@advance-labs/types`) must be locked before any app is built.

---

## 3. Shared Package Specifications

### 3.1 `@advance-labs/types`
Single source of truth for cross-package types. No runtime deps. Exports:
`Url`, `CrawlOptions`, `CrawledPage`, `PageResource`, `RobotsTxt`, `SitemapEntry`,
`ParsedHtml`, `MetaTags`, `OpenGraph`, `TwitterCard`, `HeadingNode`, `ImageInfo`, `LinkInfo`,
`StructuredDataItem`, `StructuredDataFormat`, `Finding`, `FindingSeverity`, `ScoreCategory`,
`Score`, `AuditReport`, `EeatPillar`, `EeatReport`, `LlmsTxtManifest`, `AeoSignal`.

### 3.2 `@advance-labs/crawler`
Polite, bounded crawler. `undici` for HTTP, `robots-parser`, `fast-xml-parser` for sitemaps.
- `crawl(url, opts)` — sitemap-first then link-following BFS, `maxPages` cap (50 / 12 / 1).
- Respects `robots.txt`, configurable concurrency, per-host rate limit, timeout, redirect-chain capture.
- `fetchResource(url)` — single fetch with status, headers, timing, final URL.
- Detects presence of `robots.txt`, `sitemap.xml`, `llms.txt`, HTTPS/SSL, redirect chains.

### 3.3 `@advance-labs/html-parser`
`parse5` / `cheerio`-based extraction (pure, no network). From an HTML string returns `ParsedHtml`:
meta title/description, canonical, robots directives, OpenGraph, Twitter cards, heading tree,
images + alt coverage, internal/external links, word count, FAQ/HowTo detection, raw structured-data blocks.

### 3.4 `@advance-labs/schema-validator`
Detects **all three** structured-data encodings (JSON-LD, Microdata, RDFa) — the
`structured-data-testing-tool` capability rebuilt in TS. Maps to schema.org types, validates
required properties, surfaces AEO-relevant types (FAQPage, HowTo, QAPage, Speakable, Article,
Person, Organization, BreadcrumbList, Product, Review, LocalBusiness).

### 3.5 `@advance-labs/scoring`  ← keystone
A declarative weighted-rule engine + three rule sets.
- `RuleEngine` — runs `Rule[]` against a `ScoringContext` (crawl + parsed + schema data), yields
  weighted `Finding[]` aggregated into `ScoreCategory[]` and a 0–100 `Score`.
- `technicalSeoRules` — robots/sitemap/llms.txt, HTTPS, meta, OG, canonical, structured data, content, mobile.
- `aeoRules` — AI-readiness heuristics (ported conceptually from ultralab-scanners AVS): answerability,
  schema for answer engines, crawl directives for GPTBot/ClaudeBot/PerplexityBot, content extractability.
- `eeatRules` — 4 pillars (Experience/Expertise/Authoritativeness/Trust) from the CORE-EEAT 80-item rubric.
- `singlePageMode` — same rules minus multi-page crawl signals, for the Chrome extension.

### 3.6 `@advance-labs/mcp-core`
Shared kit for the 3 MCP servers, built on `@modelcontextprotocol/sdk`.
- Remote (HTTP/SSE) and stdio transports.
- OAuth 2.1 discovery (`.well-known`) helpers for Claude.ai connector auto-registration.
- Tool registry helper with zod schemas, structured errors, logging, token-bucket rate limiting.

### 3.7 `@advance-labs/google-api`
- `Ga4Client` (GA4 Data API: `runReport`, dimensions/metrics).
- `GscClient` (Search Console: `searchanalytics.query`, `sites.list`, `sitemaps`).
- `GoogleOAuth` — read-only scopes for both, refresh-token handling, pluggable encrypted token store interface.

### 3.8 `@advance-labs/llm`
Provider-agnostic BYOK client. Default route via Vercel AI Gateway `"provider/model"` strings;
direct adapters for Anthropic, OpenAI, Groq, Perplexity Sonar. Keys never persisted server-side.

### 3.9 `@advance-labs/pdf`
`@react-pdf/renderer` report templates for audit results; lightweight `jsPDF` path for the extension.

### 3.10 `@advance-labs/ui`
React + Tailwind design system shared by web apps: `ScoreGauge`, `CategoryBreakdown`, `FixList`,
`UrlInputForm`, `ReportLayout`, `TemplateDownload`. Headless-friendly, no app-specific logic.

### 3.11 `@advance-labs/config`
Shared `eslint` flat config, `tsconfig` presets (`base`, `react-library`, `next`, `node-library`),
and prettier re-export so every package extends one source.

---

## 4. Tool (App) Specifications

| # | App | Type | Depends on | Key deliverables |
|---|-----|------|-----------|------------------|
| 1 | `llm-audit` | Next.js | crawler, html-parser, schema-validator, scoring, pdf, ui | `/api/audit/technical`, results UI, PDF, missing-file templates |
| 2 | `eeat-scanner` | Next.js | crawler, html-parser, scoring(eeat), ui | `/api/audit/eeat`, 4-pillar UI |
| 3 | `llms-txt-generator` | Next.js | crawler, html-parser, ui | crawl → `llms.txt`/`llms-full.txt`, textarea + download |
| 4 | `ai-visibility-mcp` | MCP server | mcp-core, crawler, scoring, llm | 5 tools: analyze_website_aeo, check_ai_visibility, discover_ranking_prompts, get_visibility_report, compare_competitor_visibility |
| 5 | `chrome-extension` | MV3 (Vite+CRXJS) | scoring(single), schema-validator, pdf | 21+ checks on active tab, 0–100 score, PDF export, local-only |
| 6 | `ga-gsc-chat` | Next.js | google-api, llm, ui | OAuth, preset prompt cards, BYOK chat grounded in real data |
| 7 | `ga-gsc-mcp` | MCP server | mcp-core, google-api | GA4+GSC tools, hosted OAuth discovery for Claude |
| 8 | `backlink-mcp` | stdio+remote MCP | mcp-core, llm | find_mentions, find_prospects, find_competitor_link_sources, verify_page_links, extract_contact_info, check_page_history, generate_outreach_email |
| 9 | `blogging-agent` | Node pipeline + Actions | google-api, llm | strategy/research/writer/editor/scheduler/monitor/self-correct/dedup agents |

Each app's full spec lives in `docs/tools/<app>.md`.

---

## 5. Swarm Orchestration Plan

The build is executed by an agent swarm in phases gated by the dependency graph. **Phase 0** is done
by the lead (sets conventions, removes write-contention). Each subsequent agent owns exactly one
package/app directory, never edits root files, and never runs `pnpm install` (one central install/build
pass per phase by the lead).

- **Phase 0 (lead):** root config, `@advance-labs/config`, `@advance-labs/types`, docs, CI, conventions.
- **Phase 1 (swarm, parallel):** crawler, html-parser, llm, pdf, mcp-core, google-api, ui — depend only on types.
- **Phase 1.5 (swarm, parallel):** schema-validator, scoring — depend on html-parser. *(verify barrier)*
- **Lead verify:** `pnpm install` + `turbo build typecheck test --filter='./packages/*'`; fix integration.
- **Phase 2 (swarm, parallel):** all 9 apps — depend on verified core.
- **Lead verify:** build apps, fix integration, finalize docs, commit, push.

See `docs/CONVENTIONS.md` for the exact package template every agent must follow.

---

## 6. Deployment Targets

| App | Target | Notes |
|-----|--------|-------|
| llm-audit, eeat-scanner, llms-txt-generator, ga-gsc-chat | Vercel (Fluid Compute) | Next.js App Router, Node runtime |
| ai-visibility-mcp, ga-gsc-mcp | Vercel Functions (remote MCP) | `.well-known` OAuth discovery |
| backlink-mcp | npm (stdio) + Vercel (remote) | Claude Desktop + Claude.ai |
| chrome-extension | Chrome Web Store | local-only audit, zero server calls |
| blogging-agent | GitHub Actions (scheduled) | publishes via app API/CMS |

---

## 7. Security & Compliance Baseline

- No secrets in git (`.gitignore` blocks `.env*`, `*.pem`, `service-account*.json`).
- OAuth refresh tokens encrypted at rest via a pluggable `TokenStore` interface (Supabase adapter).
- BYOK keys are request-scoped, never logged, never persisted.
- All MCP servers enforce token-bucket rate limiting and structured error responses.
- Crawler is polite by default: respects robots.txt, identifies itself, rate-limits per host.
- MIT-licensed throughout; no copied source from AGPL/proprietary references.
