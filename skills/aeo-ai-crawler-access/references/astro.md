# Astro 5

Static file: put `robots.txt` in `public/`. For a dynamic file (to build the sitemap URL from
`site`), use an endpoint. Astro calls `GET` at build time in static mode and writes the body.

```ts
// src/pages/robots.txt.ts
import type { APIRoute } from 'astro'

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('sitemap-index.xml', site)
  const body = `User-agent: *
Allow: /

User-agent: OAI-SearchBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /

# Training opt-out. Remove if the owner is happy to be trained on.
User-agent: GPTBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: Google-Extended
Disallow: /
User-agent: Applebot-Extended
Disallow: /

Sitemap: ${sitemap.href}
`
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
```

- `site` must be set in `astro.config.mjs`, otherwise `site` is undefined here and the
  `@astrojs/sitemap` integration refuses to build. The integration writes `sitemap-index.xml`
  and `sitemap-0.xml`.
- Do not keep both `public/robots.txt` and `src/pages/robots.txt.ts`.
- If the host is Cloudflare Pages/Workers, check the AI Crawl Control policy as described in
  the main skill. It can add its own `Disallow` lines on top of yours.
