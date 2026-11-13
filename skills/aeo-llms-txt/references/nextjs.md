# Next.js (App Router)

A route handler at `app/llms.txt/route.ts` builds the file from the same source as the sitemap.

```ts
// app/llms.txt/route.ts
import { getAllPages } from '@/lib/content' // your own manifest: { title, path, summary }[]

export const dynamic = 'force-static' // build once; use revalidate for ISR

export async function GET() {
  const pages = await getAllPages()
  const body = [
    '# Example Co',
    '',
    '> Example Co makes invoicing software for small agencies in Canada.',
    '',
    '## Docs',
    ...pages.map((p) => `- [${p.title}](https://example.com${p.path}): ${p.summary}`),
    '',
  ].join('\n')

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': 'noindex',
    },
  })
}
```

Share `getAllPages()` with `app/sitemap.ts` so they cannot drift.

If you prefer a static file in `public/llms.txt`, add the header in `next.config.ts`:

```ts
async headers() {
  return [{ source: '/llms.txt', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] }]
}
```

Check auth/redirect middleware does not catch `/llms.txt`.
