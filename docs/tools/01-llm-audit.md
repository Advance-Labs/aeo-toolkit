# Tool 1 — LLM & Technical SEO Audit (`apps/llm-audit`)

**Type:** Next.js (App Router) · **Deploy:** Vercel (Node runtime)
**Depends on:** `@aeo/crawler`, `@aeo/html-parser`, `@aeo/schema-validator`, `@aeo/scoring`, `@aeo/pdf`, `@aeo/ui`, `@aeo/types`

## What it does
Crawls up to 50 pages of a site (sitemap-first, then internal links), scores technical SEO **and** AEO
signals out of 100, returns a prioritized fix list, and generates ready-to-use templates for missing
files (robots.txt, llms.txt, sitemap.xml). Exports a PDF.

## Surface
- `POST /api/audit/technical` — body `{ url, maxPages? }`. Pipeline:
  `crawl()` → `parseHtml()` per page → `analyzeStructuredData()` per page → build `ScoringContext`
  → `buildAuditReport()`. Returns `AuditReport` (from `@aeo/types`).
- `GET /api/audit/technical/pdf?...` or a POST that streams `renderAuditReportPdf(report)`.
- `/` page: `UrlInputForm` → calls the API → renders `ScoreGauge`, `CategoryBreakdown`, `FixList`,
  `TemplateDownload` (all from `@aeo/ui`), with a "Download PDF" button.

## Config
- `next.config.mjs` with `transpilePackages: ['@aeo/ui', '@aeo/scoring', ...]`.
- Server-only crawl logic (route handlers run on Node, not edge).
- Env: none required for the core audit (fully self-hosted). Optional `AUDIT_MAX_PAGES`.

## Notes / stubs
- Long crawls: cap `maxPages` (default 50), enforce a wall-clock budget; stream progress if time allows.
- Rate-limit the public endpoint (per-IP) before production — mark `// STUB:` if not wired.
