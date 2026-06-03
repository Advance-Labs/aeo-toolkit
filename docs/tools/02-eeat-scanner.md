# Tool 2 — E-E-A-T Website Scanner (`apps/eeat-scanner`)

**Type:** Next.js (App Router) · **Deploy:** Vercel
**Depends on:** `@aeo/crawler`, `@aeo/html-parser`, `@aeo/schema-validator`, `@aeo/scoring` (`eeatScore`), `@aeo/ui`, `@aeo/types`

## What it does
Samples up to 12 pages and scores the four E-E-A-T pillars heuristically:
- **Experience** — content depth, FAQ/HowTo/Review schema.
- **Expertise** — author bylines, Person JSON-LD, Article markup, About/team pages.
- **Authoritativeness** — Organization schema, breadcrumbs, outbound reference links, internal linking.
- **Trust** — HTTPS, contact/privacy/terms pages, canonical coverage, Open Graph completeness.

Returns an `EeatReport` (overall /100, grade, 4 pillars with signals, improvements).

## Surface
- `POST /api/audit/eeat` — body `{ url }`. Crawl 12 pages → parse → schema → `ScoringContext`
  → `eeatScore(ctx)`.
- `/` page: `UrlInputForm` → pillar cards (one per pillar with its signals) + improvement list.

## Config
- `transpilePackages` for the `@aeo/*` deps. Reuses the same crawl/parse engine as Tool 1.

## Notes
- The scoring rubric maps to the CORE-EEAT 80-item benchmark; weights are calibrated in `@aeo/scoring`.
- Can share a route group / components with `llm-audit` later; kept separate for independent deploy.
