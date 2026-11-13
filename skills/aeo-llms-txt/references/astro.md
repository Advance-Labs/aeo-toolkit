# Astro 5

```ts
// src/pages/llms.txt.ts  -> /llms.txt, generated at build time
import { getCollection } from 'astro:content'
import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ site }) => {
  const posts = await getCollection('docs')
  const body = [
    '# Example Co',
    '',
    '> Example Co makes invoicing software for small agencies in Canada.',
    '',
    '## Docs',
    ...posts.map((p) => `- [${p.data.title}](${new URL(`/docs/${p.id}/`, site).href}): ${p.data.description ?? ''}`),
    '',
  ].join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
```

Static output cannot set response headers at build time, so `X-Robots-Tag` has to come from the
host. Put it in the host's headers file or config:

- Netlify and Cloudflare Pages: a `public/_headers` file containing

```
/llms.txt
  X-Robots-Tag: noindex
```

- Vercel: `vercel.json` `headers` entry for `/llms.txt`.
- Self-hosted nginx/Apache: add the header on that location.

(The `_headers` file format is Netlify's and Cloudflare Pages'; check your host's docs if it
is something else.)
