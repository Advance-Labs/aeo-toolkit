# Article and author schema in Next.js (App Router)

Build the graph in the page's server component from the same data that renders the byline, and
emit it with a native script tag, escaping `<` (Next.js JSON-LD guide, verified 2026-11-13,
https://nextjs.org/docs/app/guides/json-ld).

```tsx
// app/blog/[slug]/page.tsx
import { JsonLd } from '@/components/json-ld';   // see aeo-organization-entity/references/nextjs.md
import { SITE, ORG_ID } from '@/lib/entity';
import { getPost, getAuthor } from '@/lib/content';

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  const author = await getAuthor(post.authorSlug);
  const url = `${SITE}/blog/${slug}`;
  const personId = `${SITE}/authors/${author.slug}#person`;

  return (
    <article>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'BlogPosting', '@id': `${url}#article`, headline: post.title,
            url, mainEntityOfPage: { '@id': url },
            datePublished: post.publishedAt,          // ISO 8601 with offset
            dateModified: post.updatedAt ?? post.publishedAt,
            image: post.images, author: { '@id': personId }, publisher: { '@id': ORG_ID },
            isPartOf: { '@id': `${SITE}/#website` } },
          { '@type': 'Person', '@id': personId, name: author.name,
            url: `${SITE}/authors/${author.slug}`, sameAs: author.links },
        ],
      }} />
      {/* visible byline from the same `author` object */}
    </article>
  );
}
```

Notes: store timestamps as ISO strings with an offset, not `Date.toString()`. Do not default
`dateModified` to `new Date()`. For MDX/CMS content, map frontmatter fields; if `updatedAt` is
absent, omit or reuse `publishedAt`. Check the output with `curl`, since a client component
would hide the script from non-JS crawlers.
