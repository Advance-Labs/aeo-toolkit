# @aeo/llm-audit

Tool 1 of the AEO Toolkit — the **LLM & Technical SEO Audit** web app. It crawls up to 50 pages
of a site (sitemap-first, then internal links), scores **technical SEO and answer-engine
optimization (AEO)** out of 100, returns a prioritized fix list, generates ready-to-use templates
for any missing crawl-hint files (`robots.txt`, `llms.txt`, `sitemap.xml`), and exports a PDF.

It is a thin Next.js 15 (App Router) shell over the shared engine packages: the entire
**crawl → parse → detect → score → report** pipeline lives in `@aeo/*`; this app only wires the
HTTP surface and the UI.

## How it works

```
POST /api/audit/technical  { url, maxPages? }
  └─ @aeo/crawler          crawl(url)                → CrawlResult
  └─ @aeo/html-parser      parseHtml(body, finalUrl) → ParsedHtml      (per HTML page)
  └─ @aeo/schema-validator analyzeStructuredData(…)  → StructuredDataReport (per HTML page)
  └─ assemble ScoringContext{ crawl, pages, structuredData, mode: 'full-site' }
  └─ @aeo/scoring          buildAuditReport(ctx, { durationMs, version }) → AuditReport (JSON)
```

The pipeline is implemented once in `src/lib/audit-pipeline.ts` and shared by both the JSON and PDF
routes. The crawl is the only I/O seam — it is injectable (`runAudit(opts, { crawl })`) so tests run
network-free against a mocked crawler.

## Routes

| Route | Method | Body | Returns |
| --- | --- | --- | --- |
| `/api/audit/technical` | `POST` | `{ url: string, maxPages?: number }` | `AuditReport` JSON, or a structured `{ error: { code, message } }` with a 4xx/5xx status. |
| `/api/audit/technical/pdf` | `POST` | `{ report: AuditReport }` **or** `{ url, maxPages? }` | `application/pdf` stream (`renderAuditReportPdf`). Posting the already-computed report avoids a second crawl. |

Both handlers run on the **Node runtime** (`export const runtime = 'nodejs'`) — the crawler and the
react-pdf renderer are not edge-safe — and are `force-dynamic` (never statically cached).

### Error contract

Crawls are wrapped in `try/catch` and **never** return a silent 200 with a broken body. Failures map
to typed codes: `invalid_request` / `invalid_url` (400), `no_pages` (422), `crawl_failed` (502),
`rate_limited` (429), `internal_error` (500).

## UI

`/` (`src/app/page.tsx`, a client component) renders `UrlInputForm` from `@aeo/ui`, posts to the
audit API, then renders `ScoreGauge`, `CategoryBreakdown`, `FixList`, and a `TemplateDownload` for
each generated template — plus a **Download PDF** button that posts the report back to the PDF route
and triggers a browser download.

## Run

```bash
pnpm --filter @aeo/llm-audit dev      # next dev      → http://localhost:3000
pnpm --filter @aeo/llm-audit build    # next build
pnpm --filter @aeo/llm-audit start    # next start
pnpm --filter @aeo/llm-audit typecheck
pnpm --filter @aeo/llm-audit test     # vitest (pipeline + validation + rate-limit)
```

Quick API check:

```bash
curl -s -X POST http://localhost:3000/api/audit/technical \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com","maxPages":10}' | jq .score.overall
```

## Environment variables

The core audit is fully self-hosted and requires **no** credentials.

| Var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `AUDIT_MAX_PAGES` | no | `50` | Default page cap when `maxPages` is omitted. Clamped to a hard ceiling of `100`. |

## Status

**Implemented** — the full crawl → parse → detect → score → report pipeline, the JSON audit route,
the streaming PDF route, and the interactive UI are real and runnable with no credentials.

**Stubbed** — per-IP rate limiting (`src/lib/rate-limit.ts`, marked `// STUB:`) is a real but
in-memory, single-instance fixed-window limiter that resets on cold start and does not coordinate
across serverless instances. It enforces a budget today; before production, swap the implementation
behind the `RateLimiter` interface for a durable store (e.g. Upstash Redis / Vercel KV).
