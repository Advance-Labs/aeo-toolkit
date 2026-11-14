# Organization entity in Astro

Astro renders to static HTML by default, so JSON-LD is in the served page. Emit it from a
layout with `set:html` so Astro does not escape the JSON.

```astro
---
// src/lib/entity.ts exports ORG_ID, SITE, organization (same shape as the main skill)
import { organization, SITE, ORG_ID } from '../lib/entity';
const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    organization,
    { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: organization.name,
      publisher: { '@id': ORG_ID } },
  ],
};
---
<script is:inline type="application/ld+json" set:html={JSON.stringify(graph).replace(/</g, '\\u003c')} />
```

Place it in `<head>` of the layout used by the homepage, or in the page itself. Use
`Astro.site` (set `site` in `astro.config.mjs`) rather than hard-coding the origin, so staging
builds do not publish the wrong identity.

Pitfalls: a content-collection layout shared by every page will emit the full Organization on
every page; that is harmless if identical. Do not generate `@id` from `Astro.url`.
Check the built output in `dist/index.html`, not only the dev server.
