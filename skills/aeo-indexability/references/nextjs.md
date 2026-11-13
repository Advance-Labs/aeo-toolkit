# Next.js (App Router)

**Sitemap** from your content list, with real `lastModified`:

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next'
import { getAllPages } from '@/lib/content' // { path, updatedAt: Date }[]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await getAllPages()
  return pages.map((p) => ({
    url: `https://example.com${p.path}`,
    lastModified: p.updatedAt, // the content's edit date, never new Date()
  }))
}
```

Over 50,000 URLs: use `generateSitemaps()` to split. Reference it from `app/robots.ts`
(`sitemap: 'https://example.com/sitemap.xml'`).

**Canonical** per page through the Metadata API (set `metadataBase` once in the root layout):

```ts
export const metadata = { alternates: { canonical: '/pricing' } }
// or per dynamic route:
export async function generateMetadata({ params }) {
  const { slug } = await params
  return { alternates: { canonical: `/blog/${slug}` } }
}
```

With `metadataBase: new URL('https://example.com')` this renders an absolute canonical.

**noindex:** `export const metadata = { robots: { index: false, follow: true } }` on the page.
Search the codebase for `index: false` and for `X-Robots-Tag` in `next.config` and middleware
when something is unexpectedly noindex. Preview deployments often set noindex by design; make
sure that logic keys off the environment, not a flag that reaches production.

**Redirects** in `next.config.ts`; use `permanent: true` (308) and point at the final URL:

```ts
async redirects() {
  return [{ source: '/old-blog/:slug', destination: '/blog/:slug', permanent: true }]
}
```

Check for a loop between a trailing-slash setting (`trailingSlash`) and a redirect rule that
adds or removes the slash. `curl -sIL` on the URL shows it.

**hreflang:** `alternates: { languages: { 'en-CA': '/en-ca', 'fr-CA': '/fr-ca' } }` in metadata.
