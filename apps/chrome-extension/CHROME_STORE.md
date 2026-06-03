# Publishing to the Chrome Web Store

This document describes how to package and submit the **AEO/GEO Auditor** MV3
extension to the [Chrome Web Store](https://chromewebstore.google.com/). The
extension is 100% client-side: every audit runs in the user's browser and the
only network calls are same-origin probes for `robots.txt` / `sitemap.xml` /
`llms.txt` on the page being audited. **No audit data, analytics, or telemetry
ever leaves the browser**, and there are no server calls, accounts, or API keys.

## 1. Build the store archive

```bash
pnpm --filter @aeo/chrome-extension package
```

This runs `vite build` (producing `dist/`) and then zips the build output into
`apps/chrome-extension/aeo-extension.zip` — the file you upload to the store.
The zip contains the `manifest.json` at its root (Chrome requires the manifest
at the archive root, which is why the script zips the *contents* of `dist/`,
not the `dist/` folder itself).

Verify before uploading:

```bash
cd apps/chrome-extension
unzip -l aeo-extension.zip   # manifest.json must be at the top level
```

## 2. Manifest sanity check

The packaged `manifest.json` is generated from
[`manifest.config.ts`](./manifest.config.ts). Confirm:

- `manifest_version` is `3`.
- `name` is `AEO/GEO Auditor` and the `description` is store-appropriate
  (max 132 chars — keep the one-line summary short).
- `version` is bumped from the previously published version. The store rejects
  re-uploads of an already-published version number. Bump the `version` field in
  [`package.json`](./package.json); `manifest.config.ts` derives the manifest
  `version` / `version_name` from it automatically.
- `permissions` are minimal: `activeTab` + `scripting` (read the current tab's
  DOM only when the user clicks the icon).
- `host_permissions` is `<all_urls>` — required so the background worker can
  fetch the audited page's own `robots.txt` / `sitemap.xml` / `llms.txt`. Be
  ready to justify this in the store review (see the privacy note below).

## 3. Required listing assets

Prepare these before submission (the store will not publish without them):

| Asset | Spec | Notes |
| --- | --- | --- |
| **Extension icons** | 16×16, 32×32, 48×48, 128×128 PNG | Add an `icons` map (and `action.default_icon`) in `manifest.config.ts`, with the PNGs in a `public/` folder so Vite copies them into `dist/`. Until real icons are added, Chrome falls back to a generic placeholder icon — fine for local dev, **not acceptable for a public listing**. |
| **Store icon** | 128×128 PNG | The icon shown on the store listing page. |
| **Screenshots** | 1280×800 or 640×400 PNG/JPEG, 1–5 images | Capture the popup: score gauge, the site-file (robots/sitemap/llms) grid, and the checklist. |
| **Small promo tile** (optional) | 440×280 PNG/JPEG | Improves discoverability. |
| **Marquee promo tile** (optional) | 1400×560 PNG/JPEG | Only needed for featured placement. |

## 4. Listing copy

- **Short description** (≤132 chars): e.g. "Run a private, client-side AI-readiness
  (AEO/GEO) audit on any page — meta, structured data, robots/sitemap/llms.txt — and
  export a PDF."
- **Detailed description**: explain the Crawl-hint inspection, the 0–100 AI-readiness
  score, the per-signal checklist, and PDF export. Emphasize that analysis is local.
- **Category**: Developer Tools (or Productivity).
- **Language**: English.

## 5. Privacy disclosures (Web Store review)

The store requires a privacy section. Use these answers:

- **Single purpose**: "Analyze the active tab for AI/answer-engine readiness
  (AEO/GEO) and present a score with actionable fixes."
- **Permission justifications**:
  - `activeTab` / `scripting`: read the live DOM of the tab the user explicitly
    audits, only when they click the toolbar icon.
  - `host_permissions: <all_urls>`: fetch the audited origin's own `robots.txt`,
    `sitemap.xml`, and `llms.txt` to evaluate crawlability. No third-party hosts
    are contacted.
- **Data usage**: declare that the extension does **not** collect or transmit any
  user data. All analysis is performed locally in the browser; there are no
  remote endpoints, no analytics, and no telemetry. You can truthfully check
  "does not sell or transfer user data" and "does not use data for unrelated
  purposes."
- **Privacy policy URL**: if required by your developer account, link the
  repository's privacy statement (the README "Permissions & privacy" section is
  the source of truth).

## 6. Submit

1. Sign in to the
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   (one-time US$5 registration fee for the developer account).
2. Click **Add new item** and upload `aeo-extension.zip`.
3. Fill in the listing copy, upload the icons and screenshots, and complete the
   **Privacy practices** tab using the answers above.
4. Submit for review. MV3 extensions that request `<all_urls>` typically receive
   extra scrutiny; the local-only privacy posture above is the key justification.
5. After approval, bump the `version` in `package.json` for the next release and
   re-run `pnpm --filter @aeo/chrome-extension package` to produce the next zip.
