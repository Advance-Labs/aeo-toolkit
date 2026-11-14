# Next.js (App Router)

Server Components are the default, so most pages are already in the HTML. Problems come from
opting out.

**Find the opt-outs**

- `'use client'` at the top of a page or layout that fetches and renders its own text.
- Text fetched in `useEffect` / SWR / React Query on the client and rendered from state.
- `next/dynamic(() => import(...), { ssr: false })` around real content (fine for a chart,
  wrong for an article body).
- Pages exported from a `'use client'` file that return a spinner until data arrives.

**Fix: fetch on the server**

```tsx
// app/blog/[slug]/page.tsx  (Server Component, no 'use client')
import { getPost } from '@/lib/posts'

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)          // runs on the server
  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.html }} />
    </article>
  )
}
```

(In Next.js 15 and later `params` is a Promise. On 14, it is a plain object.)

**Static vs dynamic.** For content known at build time, add `generateStaticParams` so the route
is prerendered. For content that changes, use `export const revalidate = 3600` (ISR) rather
than switching to client fetching.

**Tabs and accordions.** Keep the interactive shell as a small client component, but pass the
panel content in as `children` from a Server Component so all panels are in the HTML:

```tsx
// Tabs.tsx
'use client'
export function Tabs({ panels }: { panels: { id: string; label: string; content: React.ReactNode }[] }) { /* state selects which panel is visible via the `hidden` attribute */ }
```

Render every panel with `hidden={active !== id}`, not `{active === id && panel}`.

**JSON-LD** belongs in the server-rendered tree too: `<script type="application/ld+json">` in
the Server Component output.

**Verify** against the production build, not `next dev`: `next build && next start`, then
`curl -s localhost:3000/your-page | grep -c "your headline"`. Dev mode can differ.
