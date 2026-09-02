---
title: Tool reference
description: >-
  All ten tools — five browser tools, three MCP servers with 22 tools, a content agent, and the Chrome extension — and the routes behind them.
---

The suite is **ten tools**, delivered from **two deployables**: a single Next.js app
(`apps/console`) and a Chrome extension (`apps/chrome-extension`). Everything else is a shared
library under `packages/`.

> The tools were originally nine standalone apps. [ADR-0003](../adr/0003-single-vercel-deployment.md)
> consolidated every HTTP deployable into the console; the standalone apps were deleted and their
> logic preserved in the `@advance-labs/*` packages. The historical per-tool specs are in
> [`../archive/tools/`](../archive/tools/).

## Browser tools — 5

Free, no sign-up, hosted at [advancelabs.dev/tools](https://advancelabs.dev/tools). Each is a route
in the console with a matching route handler.

| Tool | Route | API | Engine |
|---|---|---|---|
| Technical SEO + AEO audit | `/tools/audit` | `/api/audit/technical` (+ `/pdf`) | `crawler` → `html-parser` → `schema-validator` → `scoring` |
| E-E-A-T scanner | `/tools/eeat` | `/api/audit/eeat` | `scoring` (`eeatRules`) |
| llms.txt generator | `/tools/llms-txt` | `/api/generate` | `crawler` + `html-parser` |
| GA4 + GSC chat | `/tools/chat` | `/api/chat` | `google-api` + `llm` (BYOK) |
| Backlink graph (3D) | `/tools/graph` | `/api/graph` (+ `/stream`, `/expand`) | `backlinks` + WebGL |

## MCP servers — 3

Served from the console as Streamable-HTTP route handlers via the `mcp-handler` adapter, with OAuth
discovery under `/.well-known/`. **22 tools total.** The connection page is [`/mcp`](https://advancelabs.dev/mcp).

| Server | Endpoint | Auth | Tools |
|---|---|---|---|
| AI Visibility | `/api/mcp/ai-visibility/mcp` | none | `analyze_website_aeo`, `check_ai_visibility`, `discover_ranking_prompts`, `get_visibility_report`, `compare_competitor_visibility` |
| Backlink | `/api/mcp/backlink/mcp` | none | `find_prospects`, `find_mentions`, `extract_contact_info`, `check_page_history`, `generate_outreach_email`, `verify_page_links`, `find_competitor_link_sources` |
| GA4 + GSC | `/api/mcp/ga-gsc/mcp` | Google BYOK | `list_ga4_properties`, `list_gsc_sites`, `ga4_run_report`, `gsc_search_analytics`, `gsc_top_queries`, `gsc_ctr_gaps`, `compare_periods`, `gsc_traffic_drop`, `gsc_cannibalization`, `gsc_decay` |

### Skills

Three [Claude Skills](../../skills) turn the `ga-gsc` tools into workflows — *why did traffic
drop*, *are my pages competing*, *what needs refreshing*. They build on `gsc_traffic_drop`,
`gsc_cannibalization`, and `gsc_decay`.

## Content agent — 1

The blogging agent runs as a **Vercel Cron** (`/api/cron/blogging`, daily 13:00 UTC), not a separate
app. Its pipeline — research → draft → edit → dedup → schedule → publish → self-correct — lives in
[`@advance-labs/blogging`](../../packages/blogging).

## Chrome extension — 1

[`apps/chrome-extension`](../../apps/chrome-extension) runs `@advance-labs/scoring` in single-page
mode against the active tab. The audit is fully client-side — the only network calls are same-origin
fetches for `robots.txt`, `sitemap.xml`, and `llms.txt`. Exports a PDF via `jsPDF`.

## The scoring engine

All audit surfaces share one rule engine: **54 rules** across three sets.

| Rule set | Rules | Covers |
|---|---|---|
| `technicalSeoRules` | 29 | robots/sitemap/llms.txt, HTTPS, meta, Open Graph, canonical, structured data, content, mobile |
| `aeoRules` | 11 | answerability, answer-engine schema, GPTBot/ClaudeBot/PerplexityBot directives, content extractability |
| `eeatRules` | 14 | Experience, Expertise, Authoritativeness, Trust |

`singlePageMode` runs the same rules minus multi-page crawl signals — this is what the extension uses.
