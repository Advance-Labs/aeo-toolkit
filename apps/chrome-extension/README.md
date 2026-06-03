# @aeo/chrome-extension

A Chrome MV3 extension (Vite + `@crxjs/vite-plugin`) that runs a **client-side AEO/GEO
audit** on the active tab and returns a 0–100 AI-readiness score. It inspects the live
(post-JavaScript) DOM for meta tags, structured data, Open Graph / Twitter cards, heading
structure, mobile readiness and canonical signals, and fetches the origin's `robots.txt`,
`sitemap.xml`, and `llms.txt` to evaluate crawlability and AI-bot directives. Everything is
analyzed locally — the only network calls are same-origin file probes; **no audit data ever
leaves the browser**.

## How it works

```
popup (React)
  │  RUN_AUDIT
  ▼
background service worker  ──READ_DOM──▶  content script (active tab → live outerHTML)
  │                        ◀───────────
  │  fetch robots.txt / sitemap.xml / llms.txt (same-origin)
  ▼
@aeo/html-parser · @aeo/schema-validator  ──▶  single-page ScoringContext
  ▼
@aeo/scoring buildAuditReport  ──▶  Score + topFixes + templates
  ▼
popup: score gauge · site-file grid · checklist · Export PDF (jsPDF)
```

The audit assembles a synthetic single-page `ScoringContext` (`mode: 'single-page'`) so the
shared `@aeo/scoring` rule engine evaluates the one page without penalizing it for missing
multi-page-crawl signals (e.g. title uniqueness). The same engine that powers the web audit
tool drives the extension — only the I/O layer differs.

## Run it (development)

```bash
pnpm install            # from the monorepo root (run by the lead)
pnpm --filter @aeo/chrome-extension dev
```

Then load the unpacked extension:

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this app's `dist/` directory (created by `dev`/`build`).
3. Navigate to any `http(s)` page and click the **AEO/GEO Auditor** toolbar icon.

### Scripts

| Script | What it does |
| --- | --- |
| `dev` | `vite` dev build with HMR for the popup + content/background reload. |
| `build` | `vite build` → production `dist/` (the loadable/zippable extension). |
| `package` | `build`, then zip `dist/` into a store-uploadable `aeo-extension.zip` (manifest at the archive root). |
| `typecheck` | `tsc --noEmit` under strict mode. |
| `test` | `vitest run` — unit tests for the pure pipeline (mocks `@aeo/*` + I/O). |

## Permissions & privacy

- `activeTab` + `scripting` — read the current tab's DOM when you click the icon.
- `host_permissions: ['<all_urls>']` — the background worker fetches `robots.txt` /
  `sitemap.xml` / `llms.txt` from the **audited page's own origin** only.
- No analytics, no remote endpoints, no telemetry. There are no environment variables and
  no API keys: the extension is 100% client-side.

## Environment variables

None. The extension requires no keys or configuration.

## Stubbed / external I/O

The single I/O seam is same-origin site-file fetching, isolated behind the
`SiteFileFetcher` interface (`src/lib/site-files.ts`). `HttpSiteFileFetcher` is the real
`fetch`-based implementation used in the background worker; tests inject a fake so the audit
pipeline is fully runnable and testable without the network.

## Status

**Implemented.** The full audit flow is real and runnable: live-DOM extraction, same-origin
crawl-hint file fetching, single-page scoring via `@aeo/scoring`, the React popup (score
gauge, site-file grid, filterable checklist), and PDF export via jsPDF. No live credentials
are required.

## Packaging for the Chrome Web Store

```bash
pnpm --filter @aeo/chrome-extension package
```

This builds `dist/` and zips its **contents** (so `manifest.json` sits at the archive root,
as Chrome requires) into `apps/chrome-extension/aeo-extension.zip`. See
[`CHROME_STORE.md`](./CHROME_STORE.md) for the full listing/submission walkthrough — required
icon sizes (16/32/48/128 PNG), screenshots, the privacy disclosures (all analysis is local;
**zero server calls**), and version-bump steps. Add real listing icons before publishing; the
generated manifest currently relies on Chrome's default placeholder icon, which is fine for
local `Load unpacked` but not for a public listing.
