---
title: Tool reference
description: >-
  All ten tools — five browser tools, three MCP servers with 31 tools, a content agent, and the Chrome extension — and the routes behind them.
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

Served from the console as Streamable-HTTP route handlers via the `mcp-handler` adapter.
**31 tools total.** The connection page is [`/mcp`](https://advancelabs.dev/mcp).
Every tool on every server is **read-only** — none calls a write method on any upstream API.

These servers are **BYOK and implement no OAuth** — no `/authorize`, `/token` or `/register`
exists. `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`
therefore return 404 unless an *external* issuer is configured, and that 404 is what makes a
client skip the OAuth flow and send the headers that actually work.

### Connecting

Nothing to install — these are hosted HTTP endpoints. In Claude Code:

```bash
claude mcp add --transport http --scope user aeo-visibility https://aeo.advancelabs.dev/api/mcp/ai-visibility/mcp
claude mcp add --transport http --scope user aeo-backlink   https://aeo.advancelabs.dev/api/mcp/backlink/mcp
claude mcp add --transport http --scope user aeo-search     https://aeo.advancelabs.dev/api/mcp/search/mcp
```

For Claude.ai, Cursor and other clients, see the [connection page](https://advancelabs.dev/mcp)
or the JSON block in the [README](../../README.md#connect-the-mcp-servers). The trailing `/mcp`
is required — the bare `/api/mcp/<slug>` returns the adapter's own "Not found".

| Server | Endpoint | Auth | Tools |
|---|---|---|---|
| AI Visibility | `/api/mcp/ai-visibility/mcp` | none | `analyze_website_aeo`, `check_ai_visibility`, `discover_ranking_prompts`, `get_visibility_report`, `compare_competitor_visibility` |
| Backlink | `/api/mcp/backlink/mcp` | none | `find_prospects`, `find_mentions`, `extract_contact_info`, `check_page_history`, `generate_outreach_email`, `verify_page_links`, `find_competitor_link_sources` |
| Search (Google + Bing) | `/api/mcp/search/mcp` | Google BYOK; Bing BYOK optional | see below |

The search server was `GA4 + GSC` at `/api/mcp/ga-gsc/mcp`; that path still works as a compatibility
alias so existing client configs need no change, but new configs should point at `/api/mcp/search/mcp`.

### Search server — 19 tools

| Tool | Engine | Notes |
|---|---|---|
| `list_ga4_properties` | Google | |
| `list_gsc_sites` | Google | |
| `ga4_run_report` | Google | |
| `gsc_search_analytics` | Google | |
| `gsc_top_queries` | Google | |
| `gsc_ctr_gaps` | Google | |
| `compare_periods` | Google | |
| `gsc_traffic_drop` | Google | |
| `gsc_cannibalization` | Google | |
| `gsc_decay` | Google | |
| `list_bing_sites` | Bing | |
| `bing_traffic_stats` | Bing | |
| `bing_top_queries` | Bing | |
| `bing_top_pages` | Bing | |
| `bing_query_pages` | Bing | exactly one of `query`/`page` |
| `bing_index_health` | Bing | crawl stats, crawl issues, submission quota |
| `bing_keyword_research` | Bing | no Google Search Console equivalent exists |
| `compare_engines` | Google + Bing | merged rows with an explicit coverage block |
| `engine_divergence` | Google + Bing | classifies each query as google_specific / bing_specific / broad |

Bing authentication is BYOK via an `X-Bing-Api-Key` request header, or a static `BING_API_KEY`
environment variable as a fallback. A missing Bing key does not fail the server: Bing tools return
their own credential error, but the ten Google tools keep working — the server degrades to
Google-only rather than failing outright.

> **`engine_divergence` and the two engines' date windows.** Bing's `GetQueryStats` takes no date
> parameter, so `compare_engines` honours the requested range on the Google side only and labels
> the Bing side as its own unwindowed aggregate. `engine_divergence` does honour the range on both
> sides, by a different route: it fetches Bing once and buckets the rows locally on each row's own
> date, which works because Bing returns one row per (query x date) rather than one aggregate per
> query. Verified against the live API on 2026-09-09 (`maxRowsForOneQuery=3` across
> `distinctDates=6`); re-check with `pnpm --filter @advance-labs/bing-api verify:bing` if Bing's
> response shape ever looks off. When an engine cannot answer a half, that key is reported as
> `insufficient_data` — never as zero clicks, which would manufacture a confident verdict out of
> an API failure.

### Skills

Three [Claude Skills](../../skills) turn the Google tools into workflows — *why did traffic
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
