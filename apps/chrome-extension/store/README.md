# Chrome Web Store listing kit

Editable HTML/CSS sources for every listing image. Re-render with `store/render.sh`
(agent-browser + sharp; run `pnpm install` first). PNGs land in `store/export/`.

| Asset | File (`export/`) | Size | Notes |
|---|---|---|---|
| Screenshot 1 | `1-one-click.png` | 1280x800 | One-click audit, real popup on advancelabs.dev |
| Screenshot 2 | `2-score-grade.png` | 1280x800 | Score and grade, real popup on a bare page (39, F) |
| Screenshot 3 | `3-fix-list.png` | 1280x800 | Failed checks with their recommended fix |
| Screenshot 4 | `4-ai-crawlers.png` | 1280x800 | AI-crawler and llms.txt checks |
| Screenshot 5 | `5-private.png` | 1280x800 | Local-only, no account |
| Small promo tile | `promo-small-440x280.png` | 440x280 | Sphere + 3 words |
| Marquee | `promo-marquee-1400x560.png` | 1400x560 | Sphere + headline |
| Store icon | `store-icon-128x128.png` | 128x128 | 96x96 artwork, 16px transparent padding (only asset with alpha) |

Screenshots, tiles and the marquee are 24-bit PNG with no alpha. Sources: `frames/*.html`
(shared `frames/frame.css`, bundled Geist fonts from `src/popup/fonts`). `shots/` holds the raw
3x popup captures taken from the unpacked build (Chromium, `--load-extension`): advancelabs.dev,
and a local copy of example.com's HTML served as `sample.test` for the low-score shot.

Rules kept from CHROME_STORE.md: no "free", "new", "#1" or "recommended" on any image. The popup
footer link ("More free tools at ...") is cropped out of every screenshot for that reason.
`LISTING.md` is the listing copy.
