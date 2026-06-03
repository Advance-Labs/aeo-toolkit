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

## Deploy

This is a standard Next.js 15 App Router app and deploys to **Vercel** with no special
configuration — no `vercel.json` is needed (Next.js auto-detection handles the framework,
build, and output settings).

Because this lives in a pnpm + Turborepo monorepo, point Vercel at this app's subdirectory:

1. **New Project** → import the repository.
2. **Root Directory**: `apps/eeat-scanner`.
3. **Install Command** (run from the repo root so the workspace + `@aeo/*` deps resolve):
   `pnpm install` — Vercel runs this at the repo root automatically when the root directory's
   `package.json` declares workspace deps; if you override it, use
   `cd ../.. && pnpm install --filter @aeo/eeat-scanner...`.
4. **Build Command**: `pnpm --filter @aeo/eeat-scanner build`
   (or leave the default `next build` — both work since the root directory is the app).
5. **Output Directory**: leave as the Next.js default (`.next`); do not override it.
6. **Node.js version**: 20.x (matches the repo's `engines.node >= 20`).

The `/api/audit/eeat` route runs on the **Node.js runtime** (the crawler does outbound HTTP and
is not edge-safe); no extra config is required for that on Vercel.

### Environment variables

**None.** See [Environment variables](#environment-variables) below — there is nothing to set in
the Vercel dashboard. The bundled [`.env.example`](./.env.example) documents this explicitly.

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
