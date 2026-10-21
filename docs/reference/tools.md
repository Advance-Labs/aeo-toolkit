---
title: Tool reference
description: >-
  The hosted platform (six browser tools, three MCP servers with 32 tools, a content agent) and the open Chrome extension, and which parts live in this repo.
---

The hosted platform is proprietary and moved to a private repository on 2026-10-20: **six browser
tools**, **three MCP servers** with 32 tools, and a scheduled content agent, all served from
advancelabs.dev. This repo holds the open core: the six npm packages, the Chrome extension
(`apps/chrome-extension`) and the skills. Routes and engines below describe the hosted platform; its
code is not in this repo.

> The tools were originally nine standalone apps. [ADR-0003](../adr/0003-single-vercel-deployment.md)
> consolidated every HTTP deployable into one hosted app; the standalone apps were deleted and their
> logic preserved in the `@advance-labs/*` packages.

## Browser tools (6)

Free, no sign-up, hosted at [advancelabs.dev/tools](https://advancelabs.dev/tools).

| Tool | Route | API | Engine |
|---|---|---|---|
| Technical SEO + AEO audit | `/tools/audit` | `/api/audit/technical` (+ `/pdf`) | `crawler` → `html-parser` → `schema-validator` → `scoring` |
| E-E-A-T scanner | `/tools/eeat` | `/api/audit/eeat` | `scoring` (`eeatScore`, 14 signals) |
| llms.txt generator | `/tools/llms-txt` | `/api/generate` | `crawler` + `html-parser` |
| GA4 + GSC chat | `/tools/chat` | `/api/chat` | hosted Google clients + BYOK LLM |
| Backlink graph (3D) | `/tools/graph` | `/api/graph` (+ `/stream`, `/expand`) | hosted backlink engine + WebGL |
| Authority | `/tools/authority` | hosted | hosted |

## MCP servers — 3

Served by the hosted platform as Streamable-HTTP route handlers via the `mcp-handler` adapter.
**32 tools total.** The connection page is [`/mcp`](https://advancelabs.dev/mcp).
Every tool on every server is **read-only** — none calls a write method on any upstream API.

AI Visibility and Backlink need no login. **Search has one**: an anonymous request gets a 401
whose `WWW-Authenticate` names `/.well-known/oauth-protected-resource/api/mcp/search/mcp`, and the
client then logs in against the authorization server at `/api/mcp/oauth` (Dynamic Client
Registration, PKCE, and Google's consent screen as the approval step). The tokens it issues name
the user's stored Google connection, so the tools refresh Google access on their own. A raw Google
`Authorization: Bearer` token and `x-bing-api-key` still work, unchanged. The ROOT
`/.well-known/oauth-*` documents return 404 on purpose: advertising OAuth at the root would drag
the two keyless servers into a login they don't need.

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
| Search (Google + Bing) | `/api/mcp/search/mcp` | Google sign-in (OAuth) or Google BYOK; Bing BYOK optional | see below |

The search server was `GA4 + GSC` at `/api/mcp/ga-gsc/mcp`; that path still works as a compatibility
alias so existing client configs need no change, but new configs should point at `/api/mcp/search/mcp`.

### Search server — 20 tools

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
| `gsc_url_inspect` | Google | up to 25 URLs per call; read-only, cannot request indexing |
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
their own credential error, but the eleven Google tools keep working, and the server degrades to
Google-only rather than failing outright.

> **`engine_divergence` and the two engines' date windows.** Bing's `GetQueryStats` takes no date
> parameter, so `compare_engines` honours the requested range on the Google side only and labels
> the Bing side as its own unwindowed aggregate. `engine_divergence` does honour the range on both
> sides, by a different route: it fetches Bing once and buckets the rows locally on each row's own
> date, which works because Bing returns one row per (query x date) rather than one aggregate per
> query. Verified against the live API on 2026-09-09 (`maxRowsForOneQuery=3` across
> `distinctDates=6`). When an engine cannot answer a half, that key is reported as
> `insufficient_data` — never as zero clicks, which would manufacture a confident verdict out of
> an API failure.

### Skills

Three [Claude Skills](../../skills) turn the Google tools into workflows — *why did traffic
drop*, *are my pages competing*, *what needs refreshing*. They build on `gsc_traffic_drop`,
`gsc_cannibalization`, and `gsc_decay`.

## Content agent — 1

The blogging agent runs as a **Vercel Cron** (`/api/cron/blogging`, daily 13:00 UTC), not a separate
app. Its pipeline — research → draft → edit → dedup → schedule → publish → self-correct — lives in
the hosted platform (the code is in the private repository).

## Chrome extension — 1

[`apps/chrome-extension`](../../apps/chrome-extension) runs `@advance-labs/scoring` in single-page
mode against the active tab. The audit is fully client-side — the only network calls are same-origin
fetches for `robots.txt`, `sitemap.xml`, and `llms.txt`. Exports a PDF via `jsPDF`.

## The scoring engine

All audit surfaces share one rule engine. The code is the source of truth:

| Rule set | Count | Covers |
|---|---|---|
| `technicalSeoRules` | 31 | robots/sitemap/llms.txt, HTTPS, meta, Open Graph, canonical, structured data, content, mobile |
| `aeoRules` | 13 | answerability, answer-engine schema, GPTBot/ClaudeBot/PerplexityBot directives, content extractability |
| `auditRules` (the two above) | 44 | what the hosted technical audit runs |
| `eeatSignalDefs` | 14 | the separate E-E-A-T scan: Experience, Expertise, Authoritativeness, Trust |

44 + 14 = 58 is the engine total, never what a single audit runs. The Chrome Web Store build (0.2.0)
runs 40 checks and the next build runs 44.

`mode: 'single-page'` runs the same rules minus multi-page crawl signals; this is what the extension uses.
