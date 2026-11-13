# Astro 5

**Sitemap:** `npx astro add sitemap`, and set `site` in `astro.config.mjs`. The integration
needs `site` to build.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/thank-you/'),
      // lastmod: only set if you have a real per-page date; a single build-time value is the
      // antipattern the audit flags. Check the integration docs for per-page serialize().
    }),
  ],
})
```

It writes `sitemap-index.xml` and `sitemap-0.xml`. Reference `sitemap-index.xml` in robots.txt.

**Canonical:** in your layout, `<link rel="canonical" href={new URL(Astro.url.pathname, Astro.site)} />`.
Use `Astro.site`, not `Astro.url.origin`, so preview hosts never leak into production canonicals.

**Redirects:** static redirects in config; they output meta-refresh HTML pages on static
builds, which is weaker than a server 301. On a host with its own redirect file (`_redirects`,
`vercel.json`), prefer the host-level 301.

```js
redirects: { '/old-page': '/new-page' }
```

**noindex:** `<meta name="robots" content="noindex" />` in the layout, passed in by a prop.
**hreflang:** `<link rel="alternate" hreflang="en-CA" href="..." />` per language, reciprocal.
