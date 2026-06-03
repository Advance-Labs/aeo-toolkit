# Tool 3 — llms.txt Generator (`apps/llms-txt-generator`)

**Type:** Next.js (App Router) · **Deploy:** Vercel
**Depends on:** `@aeo/crawler`, `@aeo/html-parser`, `@aeo/ui`, `@aeo/types`

## What it does
Accepts a URL, crawls the site structure (sitemap + key pages), extracts titles/descriptions, and
generates a structured `llms.txt` (and optional `llms-full.txt`) manifest per the emerging
[llmstxt.org](https://llmstxt.org) spec: H1 site name, blockquote summary, sectioned link lists,
optional contact/license. Output renders in a `<textarea>` with one-click download.

## Surface
- `POST /api/generate` — body `{ url, full?: boolean }`. Pipeline: `crawl()` → group pages into
  sections (docs/blog/product/other by URL path heuristics) → build `LlmsTxtManifest` → render to text.
- Pure renderer `renderLlmsTxt(manifest): string` and `renderLlmsFullTxt(...)` (place in app `src/lib`).
- `/` page: form → textarea(s) → download buttons (`llms.txt`, `llms-full.txt`).

## Config
- No external API needed (titles/descriptions come from the crawl, not an LLM). If a summarizer is
  desired later, route it through `@aeo/llm` (BYOK) and mark the seam.

## Notes
- Keep a version-aware template (the spec is evolving). Document the spec version in the output header comment.
