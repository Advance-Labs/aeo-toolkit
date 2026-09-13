# AEO Toolkit — Brand

The brand that shipped with the September 2026 website redesign. In one line: **a calibrated
instrument, printed.** Near-black ground, one acid-green signal colour, violet as the
secondary, mono labels like the margin notes on a lab sheet, Syne headlines, and the Advance
Labs sphere as the mark.

## Mark

The mark is the **Advance Labs sphere**, the crumpled-paper polyhedron from
[advancelabs.dev](https://advancelabs.dev). AEO Toolkit is an Advance Labs product and carries the
studio's mark; the wordmark carries the product name.

| File | Use |
|------|-----|
| [`mark-256.png`](mark-256.png) | The mark alone, square, transparent. Favicons, app icons, avatars. |
| [`mark-512.png`](mark-512.png) | Same, for social cards, README and print. |
| [`logo-dark.png`](logo-dark.png) | Horizontal lockup (mark + wordmark in Signal green) for **dark** backgrounds. Transparent. |
| [`logo.png`](logo.png) | Horizontal lockup (mark + wordmark in Ink) for **light** backgrounds. Transparent. |
| [`logo-dark-preview.png`](logo-dark-preview.png) | The dark lockup composited on the `#0A0A0B` ground, for previews. |
| [`social-preview.png`](social-preview.png) | 1280×640 card for the GitHub repository social preview (upload under Settings). |

The sphere is a photographed object, so the assets are rasters with alpha; there is no vector
version. The 1024 px master is the `MoonAinB.png` served by advancelabs.dev.

In `apps/console`, use `BrandMark` / `BrandLockup` from `src/components/BrandMark.tsx` rather
than these files. The Chrome extension's icons are generated from `src/icons/icon.svg`, which
embeds the same sphere.

## Wordmark

**AEO Toolkit** in Syne Bold, tracking `-0.01em`. Signal `#A8F326` on dark grounds, Ink `#16150F`
on light. Never gradient, never outlined, never a different face.

## Palette

Roles first, hex second. In code, use the token, not the number.

| Role | Hex | Token |
|------|-----|-------|
| Ground | `#0A0A0B` | `--bg`, `--v2-bg` |
| Text | `#F4F4F5` | `--v2-text` |
| Text, soft / faint | `#B6B6BD` / `#9A9AA6` | `--v2-ink-soft`, `--v2-ink-faint` |
| Rule | `rgba(255,255,255,.09)` | `--v2-rule` |
| **Signal** (the one accent) | `#A8F326` | `--v2-signal`, Tailwind `brand-cyan` (legacy name) |
| Signal, hover | `#C3FF57` | `--v2-signal-hover` |
| Secondary (violet) | `#B6A4FD` | `--v2-accent2`, Tailwind `brand-violet` |
| Secondary, deep | `#7C3AED` | Tailwind `brand-indigo` (legacy name) |
| Paper / Ink | `#F4F4F5` / `#16150F` | the printed report and specimen sheet |
| OK / Warn | `#3FBF8A` / `#D9974F` | `--v2-ok`, `--v2-warn` (audit results only) |

Rules: one Signal element per view; violet never carries a call to action; no gradient text or
gradient backgrounds; text is off-white on near-black, never pure white on pure black.

The Tailwind keys `brand.indigo` / `brand.violet` / `brand.cyan` in
`apps/console/tailwind.config.ts` resolve to the new palette so existing classes render
correctly; treat the names as historical and prefer the CSS variables in new code.

## Type

| Role | Face | Token |
|------|------|-------|
| Wordmark and headlines | **Syne** 600–800 | `--font-brand`, `--font-display`, `--font-v2-display` |
| Body | **Inter** (app), **Archivo** (landing) | `--font-sans`, `--font-v2-sans` |
| Labels, numbers, code | **JetBrains Mono** (app), **IBM Plex Mono** (landing) | `--font-mono`, `--font-v2-mono` |
| Editorial serif | **Instrument Serif** italic | `--font-v2-serif` |

Labels are mono, uppercase, tracked, and numbered like a lab sheet (`01 · ASK`). Figures are
mono with `tabular-nums`. No exclamation marks; every number in copy traces to a file in this
repo.

## Where the tokens live

| What | File |
|------|------|
| App tokens | `apps/console/src/app/globals.css` |
| Landing tokens and utilities (`v2-frame`, `v2-glass`, `v2-label`, `v2-brackets`) | `apps/console/src/components/landing-v2/landing-v2.css` |
| Tailwind palette and fonts | `apps/console/tailwind.config.ts` |
| Mark component | `apps/console/src/components/BrandMark.tsx` |
| Favicon / app icons / OG cards | `apps/console/src/app/icon.png`, `apple-icon.png`, `src/lib/og.tsx` |
| Docs site theme | `apps/docs/src/styles/brand.css` |

## Rules for the mark

- Minimum size 16 px. Lockup at least 160 px wide.
- Clear space around the mark of at least a quarter of its width.
- Don't tint, outline, rotate, or put a ring behind the sphere; don't recolour or restyle the
  wordmark; don't place either on a mid-grey ground where the off-white sphere loses its edge.

## App icons: the mark carries its own ground

Where we do **not** control the background, the sphere ships composited on a rounded `#0A0A0B`
tile rather than on transparency. The sphere is off-white with no outline — measured on the
128 px raster it is 56.7% transparent at a mean luminance of 155/255 — so on a white ground it
very nearly disappears, and the Chrome Web Store listing card and the light-mode Chrome toolbar
are both white. This is the same reason `logo-dark-preview.png` exists; an app icon is that
problem in a smaller box.

| Surface | Treatment |
|---------|-----------|
| Chrome extension icons (16/32/48/128) | Sphere on a rounded `#0A0A0B` tile, radius `size × 28/128` |
| Favicons, app icons, avatars | Same, wherever the host renders on an unknown ground |
| Anywhere we own the ground (site, docs, README on GitHub's dark UI) | The transparent mark, as above |

Clear space and the 16 px mark minimum **collide on small tiles** — a quarter-width inset on a
16 px icon leaves a 10 px sphere, under the mark's own floor. Clear space is what gives, because
it is breathing room and legibility is a requirement. The inset therefore tightens as the tile
shrinks: the sphere takes 64% of the tile at 128 and 48, 78% at 32, 88% at 16. That table lives
in `apps/chrome-extension/scripts/generate-icons.mjs`; change it there, not by hand-editing PNGs.

## Previous brand

The indigo→violet tile with the white "A" and cyan sparkle (`#6366F1` / `#8B5CF6` / `#22D3EE`)
was retired with the September 2026 redesign, along with the aurora backdrop and gradient text.
Its SVGs were removed from this folder, as were `@advance-labs/ui`'s `Logo` / `LogoMark`
components that drew it.
