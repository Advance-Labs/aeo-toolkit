# Tool 5 — AEO/GEO Chrome Extension (`apps/chrome-extension`)

**Type:** Chrome MV3 extension (Vite + `@crxjs/vite-plugin`) · **Deploy:** Chrome Web Store
**Depends on:** `@aeo/scoring` (single-page mode), `@aeo/schema-validator`, `@aeo/types`. PDF via `jsPDF` (local).

## What it does
Runs a 21+ check AEO/SEO audit on the **active tab** in real time — meta tags, structured data,
robots.txt, sitemap.xml, llms.txt, canonical, mobile readiness, Open Graph, Twitter cards, AI-bot
directives. Returns a 0–100 AI-readiness score and exports a PDF. Audit runs locally — zero server calls.

## Structure
- `manifest.config.ts` (MV3) — permissions: `activeTab`, `scripting`; host permissions for fetching
  `robots.txt` / `sitemap.xml` / `llms.txt` of the current origin from the background worker.
- `src/content/` — reads the live DOM, runs `@aeo/html-parser`-style extraction + `@aeo/schema-validator`.
- `src/background/` — fetches the site files (`robots.txt`, `sitemap.xml`, `llms.txt`) for the origin.
- `src/popup/` — React UI: score gauge, check list, "Export PDF" (jsPDF).
- Scoring uses `@aeo/scoring` with `mode: 'single-page'` and a synthetic single-page `ScoringContext`.

## Notes
- Bundle `@aeo/*` deps into the extension build (no Node at runtime). Vite handles the workspace deps.
- `jsPDF` (not `@aeo/pdf`/react-pdf) is used here because the extension has no Node/server.
- Keep all analysis client-side; the only network calls are same-origin file fetches.
