<p align="center"><img src="../../brand/logo.svg" alt="AEO Toolkit" width="280"></p>

# @aeo/llms-txt-generator

> Crawl any site and generate a structured llms.txt (and optional llms-full.txt) per the llmstxt.org spec.

Next.js (App Router) tool that accepts a URL, crawls the site structure (sitemap-first +
breadth-first link following), extracts each page's title/description, groups pages into
sections by URL-path heuristics (docs / blog / product / other), and generates a structured
[`llms.txt`](https://llmstxt.org) — plus an optional expanded `llms-full.txt`. Output renders
in `<textarea>`s with one-click downloads.

## How to run

```bash
pnpm --filter @aeo/llms-txt-generator dev      # http://localhost:3000
pnpm --filter @aeo/llms-txt-generator build
pnpm --filter @aeo/llms-txt-generator start
pnpm --filter @aeo/llms-txt-generator test     # vitest (renderers + pipeline, no network)
pnpm --filter @aeo/llms-txt-generator typecheck
```

Enter a URL, optionally tick **Also generate llms-full.txt**, click **Generate**.

## API

`POST /api/generate` (Node runtime)

```jsonc
// request
{ "url": "example.com", "full": false }

// response
{
  "llmsTxt": "<!-- llms.txt ... -->\n# Example\n> ...\n## Docs\n- [Title](url): desc\n",
  "llmsFullTxt": "...",          // only when full=true
  "manifest": { "siteName": "Example", "sections": [ ... ] },
  "pageCount": 12,
  "url": "https://example.com/"
}
```

The URL is normalized (scheme prepended if omitted). Errors return `{ error }` with a 4xx
(bad input) or 502 (crawl failure) status.

## Pipeline

```
URL ─▶ @aeo/crawler.crawl() ─▶ CrawlResult
                                   │
        @aeo/html-parser.parseHtml() per page  (lib/manifest.ts)
                                   │
        group by URL path (lib/sections.ts) ─▶ LlmsTxtManifest
                                   │
        lib/render.ts  renderLlmsTxt / renderLlmsFullTxt ─▶ text
```

- `src/lib/render.ts` — pure renderers (`renderLlmsTxt`, `renderLlmsFullTxt`) following the
  llmstxt.org Markdown format: `#` site name, `>` summary blockquote, `## Section` headings with
  `- [title](url): description` bullets, optional Contact/License trailers. The targeted spec
  revision is emitted as an HTML comment header (`LLMS_TXT_SPEC_VERSION`).
- `src/lib/sections.ts` — pure path-heuristic bucketing.
- `src/lib/manifest.ts` — pure `CrawlResult → LlmsTxtManifest` assembly.
- `src/lib/generate.ts` — orchestrator; the crawl is an injectable seam (`CrawlFn`) so the
  pipeline is unit-testable without a network.

## Consumes

`@aeo/crawler` · `@aeo/html-parser` · `@aeo/ui` (`UrlInputForm`) · `@aeo/types`.

## Env vars

None. Titles and descriptions come from the crawl, not an LLM. If a summarizer is desired later,
route it through `@aeo/llm` (BYOK, request-scoped keys — never persisted/logged) and mark the seam
with `// STUB:`.

## Deploy

Standard Next.js (App Router) app — deploys to **Vercel** with no special configuration and **no
`vercel.json`** (Next.js auto-detection covers framework, build, and output settings).

In this pnpm + Turborepo monorepo, point Vercel at the app's subdirectory:

1. **New Project** → import the repository.
2. **Root Directory**: `apps/llms-txt-generator`.
3. **Install Command**: `pnpm install` at the repo root (Vercel installs the workspace so the
   `@aeo/*` deps resolve; if overriding, use
   `cd ../.. && pnpm install --filter @aeo/llms-txt-generator...`).
4. **Build Command**: `pnpm --filter @aeo/llms-txt-generator build` (or the default `next build` —
   both work once the root directory is set to this app).
5. **Output Directory**: leave as the Next.js default (`.next`); do not override.
6. **Node.js version**: 20.x (matches the repo's `engines.node >= 20`).

The `/api/generate` route runs on the **Node.js runtime** (the crawler does outbound HTTP); no extra
Vercel config is required.

### Environment variables

**None.** Titles/descriptions come from the crawl, not an LLM, so there is nothing to set in the
Vercel dashboard. The bundled [`.env.example`](./.env.example) documents this. (If a summarizer is
added later via `@aeo/llm`, keys must be **BYOK / request-scoped — never persisted or logged**.)

## Status

**Implemented.** Full crawl → parse → group → render → download pipeline is real and runnable.
No external API keys required, so no live-credential stub is needed. The only injectable seam is the
crawler (`CrawlFn` in `generate.ts`), which defaults to `@aeo/crawler` and is faked in tests. Vitest
covers the renderers (`render.test.ts`), the section heuristics (`sections.test.ts`), and the
end-to-end pipeline with a mocked `@aeo/html-parser` and a fake crawler (`generate.test.ts`).
