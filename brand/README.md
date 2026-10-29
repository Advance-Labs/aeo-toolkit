# AEO Toolkit: Brand

> **2026-10-20:** `apps/console` and the internal packages it uses moved to a private repository.
> References to them below describe the hosted platform; the code is no longer in this repo.

The brand that shipped with the October 2026 pixel-art redesign. In one line: **a dusk sky, a
figure and a sphere, drawn in coarse dithered pixels.** Warm paper ground, ink text, two dusk
oranges as the only colour, Geist Pixel labels, and a faceted sphere as the mark. The line it
carries: *The next big thing will be a lot of small things.*

## Mark

The mark is the faceted sphere: flat facets, lit faces in dusk, unlit faces in card, lines in faint ink.

| File | Use |
|------|-----|
| [`aeo-toolkit-mark-256.png`](aeo-toolkit-mark-256.png), [`mark-256.png`](mark-256.png), [`mark-512.png`](mark-512.png) | The mark alone, square, transparent. In-page logos, READMEs. `mark-512.png` is a 2x upscale of the 256 raster. |
| [`mark.svg`](mark.svg) | Vector mark. |
| [`icon-256.png`](icon-256.png) | The mark on a rounded paper tile (an app-icon exception to the square-corner rule), for avatars and app icons. |
| [`logo.png`](logo.png) | Horizontal lockup (mark + wordmark in Ink) for **light** backgrounds. Transparent. |
| [`logo-dark.png`](logo-dark.png) | Horizontal lockup (mark on a Card tile, wordmark in Card) for **dark** backgrounds. Transparent. |
| [`logo-dark-preview.png`](logo-dark-preview.png) | The dark lockup composited on the `#1a1916` ground, for previews. |
| [`social-preview.png`](social-preview.png) | 1280×640 GitHub social card: the live hero with "AEO Toolkit · 44 checks · open core". Upload under Settings. |

In `apps/console`, use `BrandMark` / `BrandLockup` from `src/components/BrandMark.tsx` rather
than these files. The Chrome extension's icons are committed PNGs in
`apps/chrome-extension/public/icons/`.

## Palette

Roles first, hex second. In code, use the token, not the number.

| Role | Hex | Notes |
|------|-----|-------|
| Ink | `#1a1916` | Text, lines, primary buttons |
| Faint | `#78736a` | Secondary text, facet lines, rgb 120 115 106 |
| Stone | `#c4bfb6` | Rules, borders, disabled |
| Card | `#f6f3ee` | Cards, unlit facets |
| Page / concrete | `#ece8e1` | The page ground |
| Dusk 1 | `#f2b27a` | Lit facets, highlights |
| Dusk 2 | `#d98a7a` | Lit facets, the second dusk tone |
| Accent text | `#a84b2a` | Numerals and small accent text only |

The dusk sky is a dithered band: slate `#8a93a3`, then `#c9b8ad`, then peach `#f2c39a`, then `#e9a88f`.

Rules: lit facets are exactly Dusk 1 or Dusk 2, unlit facets are Card, lines are Faint ink. There is
no green and no violet anywhere. No gradient text and no gradient backgrounds in the product.

## Pixel rules

- **Cell size.** Art is drawn at a coarse resolution, `CELL` = 3.5 screen px per art pixel, then
  scaled up with hard edges (`image-rendering: pixelated`). Never smooth it.
- **Dither.** Colour is snapped to the small palette with a 4×4 Bayer ordered dither. No error
  diffusion, no blur, no anti-aliasing.
- **Greys stay grey.** Grey pixels snap only to greys, so the figure never picks up dusk tint.
- **Figure.** A 4-tone dithered cut-out of the brand art ("Low-Poly Figure Pushing Geometric Sphere"),
  animated as an 8-frame push cycle.
- **Flat facets.** Spheres are flat-shaded facets, never smooth gradients or lighting.
- **Square corners.** No rounded corners. Elevation is a hard offset shadow, never a blur.

## Type

| Role | Face |
|------|------|
| Labels, nav, buttons | **Geist Pixel Square**, from the `geist` package (`geist/font/pixel`) |
| Headings and body | **Geist Sans** |
| Code and figures | **Geist Mono**, `tabular-nums` for numbers |

Labels are uppercase and tracked, numbered like a lab sheet (`01 / CRAWL AND SCORE`). No
exclamation marks; every number in copy traces to a file in this repo.

## Where the tokens live

The tokens and the pixel components (`pixel.ts`, `Sisyphus`, `SphereCanvas`, `sphere.ts`, and
`.f-sky` / `.f-pixel` in `globals.css`) live in the console's `components/field/` folder and
`apps/console/src/app/globals.css`, which are in the private repository. Mark component:
`apps/console/src/components/BrandMark.tsx`. Docs site theme: `apps/docs/src/styles/brand.css`.

## Rules for the mark

- Minimum size 16 px. Lockup at least 160 px wide.
- Clear space around the mark of at least a quarter of its width.
- Don't tint, outline, rotate, or smooth the sphere; don't recolour or restyle the wordmark.
