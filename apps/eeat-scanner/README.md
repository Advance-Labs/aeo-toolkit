# @aeo/eeat-scanner

E-E-A-T Website Scanner (Tool 2). A Next.js 15 App Router app that crawls up to
**12 pages** of a site, parses each page, detects structured data, and scores the
four E-E-A-T pillars — **Experience, Expertise, Authoritativeness, Trust** —
using the shared `@aeo/scoring` engine (`eeatScore`).

It reuses the exact **Crawl → Parse → Detect → Score** pipeline as the technical
audit tool:

```
URL → @aeo/crawler → @aeo/html-parser → @aeo/schema-validator → ScoringContext → eeatScore → EeatReport
```

## How to run

```bash
pnpm --filter @aeo/eeat-scanner dev      # next dev (http://localhost:3000)
pnpm --filter @aeo/eeat-scanner build    # next build
pnpm --filter @aeo/eeat-scanner start    # next start (after build)
pnpm --filter @aeo/eeat-scanner typecheck
pnpm --filter @aeo/eeat-scanner test     # vitest
```

Open `/`, enter a URL, and the page renders one card per pillar (its 0–100 score,
each signal marked present/absent, and per-signal recommendations) plus an ordered
list of improvements.

## API

### `POST /api/audit/eeat`

Server-side, **Node runtime** (the crawler does outbound HTTP — not edge-safe).

Request body:

```json
{ "url": "example.com" }
```

A bare hostname is normalized to `https://`. Returns the `EeatReport` shape from
`@aeo/types`:

```jsonc
{
  "url": "https://example.com/",
  "generatedAt": "2026-…",
  "overall": 72,
  "grade": "C",
  "pillars": [ /* { key, label, score, signals[] } × 4 */ ],
  "pagesCrawled": 12,
  "improvements": ["…"]
}
```

| Status | Meaning |
|--------|---------|
| `200`  | `EeatReport` JSON |
| `400`  | Invalid/missing `url`, bad JSON, or non-http(s) scheme |
| `502`  | The crawl/scoring pipeline threw (e.g. host unreachable) |

## Environment variables

**None.** The scanner takes only a URL and crawls public pages. There are no API
keys, OAuth, or paid integrations — nothing to configure or persist.

## Architecture notes

- The single external-I/O seam is the injectable `Crawler` interface in
  `src/lib/pipeline.ts` (marked `// STUB-SEAM:`). In production it is the real
  network-backed `@aeo/crawler.crawl`; tests inject a deterministic fake so the
  entire pipeline runs **without any live network**.
- All domain shapes (`EeatReport`, `ScoringContext`, `ParsedHtml`, …) come from
  `@aeo/types` and are never redefined here.
- Only OK HTML responses with a body are parsed; 404s and binary assets are
  skipped so a single bad URL can't poison the score. With ≤1 parsed page the
  context uses `single-page` mode so the scorer grades gracefully.

## Status

**Implemented.** The crawl → parse → schema → `eeatScore` pipeline, the
`POST /api/audit/eeat` route, and the full pillar-card UI are all real and
runnable. The only seam is the live HTTP crawler (real `@aeo/crawler` in prod,
injectable fake in tests). No external credentials are required. Vitest tests
mock the `@aeo/*` engines and the crawler so they run network-free.
