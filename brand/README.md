# AEO Toolkit — Brand

The mark is a rounded app-tile holding an **"A"** drawn as an upward peak — Answer / AEO / Advance,
*rising in AI answers* — with a cyan **AI sparkle** off the apex.

## Assets

| File | Use |
|------|-----|
| [`mark.svg`](mark.svg) | The icon alone (square). Favicons, app icons, avatars. |
| [`favicon.svg`](favicon.svg) | Same mark, named for favicon use. |
| [`logo.svg`](logo.svg) | Horizontal lockup (mark + wordmark) for **light** backgrounds. |
| [`logo-dark.svg`](logo-dark.svg) | Horizontal lockup for **dark** backgrounds. |

In a React app, prefer the `<Logo />` / `<LogoMark />` components from `@advance-labs/ui` (themeable, no asset fetch).

## Palette

| Token | Hex | Use |
|-------|-----|-----|
| Indigo | `#6366F1` | Tile gradient start |
| Violet | `#8B5CF6` | Tile gradient end |
| Cyan (spark) | `#22D3EE` | AI sparkle accent |
| Ink | `#0F172A` | Wordmark "AEO" on light |
| Slate | `#64748B` | Wordmark "Toolkit" on light |
| Light | `#F8FAFC` / `#94A3B8` | Wordmark on dark |

On dark surfaces the tile lightens to Indigo `#818CF8` → Violet `#A78BFA` for contrast.

## Clear space & sizing

- Keep clear space ≥ the tile's corner radius on all sides.
- Minimum mark size: 16px (favicon). The wordmark lockup: ≥ 120px wide.
- Don't recolor the sparkle, stretch the lockup, or place the mark on a low-contrast background.
