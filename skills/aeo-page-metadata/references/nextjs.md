# Page metadata in Next.js (App Router)

Checked against the Next.js `generateMetadata` API reference via Context7 on 2026-11-13.
Pages Router projects use `next/head` instead; the rules above still apply.

## What Next gives you for free

- `<meta charset="utf-8">` and `<meta name="viewport" content="width=device-width, initial-scale=1">`
  are always added, even on a route with no metadata. If `tech.charset-declared` or
  `tech.viewport-mobile` fails on a Next App Router site, check whether the page is really served by
  Next (a proxy, a static export of something else) before editing code.
- `<html lang>` is **not** automatic. Set it in the root layout: `<html lang="en">`. This is the
  usual cause of `tech.lang-declared`.

## Layout defaults and per-page overrides

```tsx
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://example.com'),   // lets other fields use relative URLs
  title: { template: '%s | Acme', default: 'Acme: short description of the business' },
  description: 'One accurate sentence about the site.',
  openGraph: { type: 'website', siteName: 'Acme', images: ['/og-default.png'] },
  twitter: { card: 'summary_large_image' },
};
```

```tsx
// app/guides/[slug]/page.tsx
import type { Metadata } from 'next';

// params is a Promise in Next 15+; on 14 and earlier it is a plain object
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);            // your data call
  const url = `/guides/${slug}`;
  return {
    title: post.title,                          // gets the " | Acme" template
    description: post.summary,
    alternates: { canonical: url },
    openGraph: { type: 'article', url, title: post.title, description: post.summary,
                 images: [post.image ?? '/og-default.png'] },
    twitter: { card: 'summary_large_image', title: post.title, description: post.summary },
  };
}
```

Notes:

- A `title.template` needs a `title.default`. A child title of "About" renders `About | Acme`.
  Template titles count toward the 30 to 60 character check, so a long suffix can push a short
  page title over the limit. Judge the final rendered title.
- With `metadataBase` set, `alternates.canonical`, `openGraph.url` and image paths can be relative;
  Next composes absolute URLs. Without it, give absolute URLs.
- Nested metadata objects such as `openGraph` in a child segment replace the parent's object rather
  than merging field by field. If a page sets `openGraph.title` only, the inherited `images` and
  `siteName` are gone. Repeat the fields you need, or build the object from a shared helper.
- `export const metadata` and `generateMetadata` work in Server Components only, not in files with
  `'use client'`.
- Set `openGraph.url` to the canonical URL of the page, not the request URL with parameters.

## Duplicate titles

`tech.unique-titles` almost always means pages inherit the layout's `title.default` because no
route defines its own. Add `generateMetadata` to dynamic routes and a `metadata` export to static
ones.

## Images and alt

Use `next/image` with an explicit `alt` prop; omit nothing. Decorative image: `alt=""`.

## Verify

View source of a built page (`curl` the production or `next start` output), not the dev overlay.
