# Next.js (App Router)

`app/robots.ts` returns a `MetadataRoute.Robots` object and Next serves it as `/robots.txt`.
Multiple bots go in the `rules` array; `userAgent` can be a string or an array.

```ts
// app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot'], allow: '/' },
      // Training opt-out. Remove this entry if the owner is happy to be trained on.
      { userAgent: ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended'], disallow: '/' },
    ],
    sitemap: 'https://example.com/sitemap.xml',
  }
}
```

- A static `public/robots.txt` also works, but do not have both: pick one.
- Use the real production origin in `sitemap`. Do not build it from a preview URL env var, or
  the deploy preview's host ends up in production's robots.txt.
- Check `middleware.ts` / `proxy.ts` matchers: a rule that rewrites or redirects unknown user
  agents will also catch bots. Exclude `/robots.txt` and `/sitemap.xml` from auth middleware.
- On Vercel, also check Firewall rules and Attack Challenge Mode, which challenge bots at the
  edge regardless of robots.txt.

Verify: `curl -s https://<prod-host>/robots.txt`.
