# Page metadata in Astro

Checked against the Astro docs (layouts and recipes) via Context7 on 2026-11-13. Astro has no
built-in metadata API. Metadata lives in a layout or a `<Head>` component that every page uses.

## One layout, props in, tags out

```astro
---
// src/layouts/Base.astro
interface Props { title: string; description: string; image?: string; type?: 'website' | 'article'; }
const { title, description, image = '/og-default.png', type = 'website' } = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site);   // needs `site` in astro.config
const ogImage = new URL(image, Astro.site);
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content={type} />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content={ogImage} />
    <meta name="twitter:card" content="summary_large_image" />
  </head>
  <body><slot /></body>
</html>
```

Make `title` and `description` **required** props. A default value is how every page ends up with
the same title (`tech.unique-titles`) or a missing description. If a page forgets them, the build
should fail, not ship a generic one.

## Specifics

- Set `site` in `astro.config.*`. Without it `Astro.site` is undefined and the canonical and OG
  URLs break.
- `lang`: for multilingual sites compute it from the route (the Astro i18n recipe derives it from
  `Astro.url`) rather than hard-coding `en`.
- Content collections: put `title`, `description`, `image` and an `updated` date in the frontmatter
  schema (zod), mark `title` and `description` required, and pass them into the layout. That also
  gives `aeo-content-freshness` a real date source.
- Images: use the `<Image />` component or `<img>` with an `alt`. Astro requires `alt` on `<Image />`
  at build time; use `alt=""` for decoration.
- Astro renders to static HTML by default, so tags are in the served HTML. If you added client-only
  islands that set `document.title`, move that to the layout.

## Verify

Run `astro build` only if the user asks (heavy on small machines). Otherwise inspect the deployed
page with `curl` and look at the `<head>`.
