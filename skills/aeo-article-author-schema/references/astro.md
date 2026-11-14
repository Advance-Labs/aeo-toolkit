# Article and author schema in Astro

In the blog layout, compute the graph from frontmatter or the content collection entry and emit
it with `set:html`.

```astro
---
import { SITE, ORG_ID } from '../lib/entity';
const { post, author } = Astro.props;            // from getEntry / getCollection
const url = new URL(`/blog/${post.id}`, Astro.site).href;
const personId = `${SITE}/authors/${author.id}#person`;
const graph = { '@context': 'https://schema.org', '@graph': [
  { '@type': 'BlogPosting', '@id': `${url}#article`, headline: post.data.title, url,
    mainEntityOfPage: { '@id': url },
    datePublished: post.data.pubDate.toISOString(),
    dateModified: (post.data.updatedDate ?? post.data.pubDate).toISOString(),
    author: { '@id': personId }, publisher: { '@id': ORG_ID } },
  { '@type': 'Person', '@id': personId, name: author.data.name,
    url: `${SITE}/authors/${author.id}`, sameAs: author.data.links },
] };
---
<script is:inline type="application/ld+json" set:html={JSON.stringify(graph).replace(/</g, '\\u003c')} />
```

`toISOString()` yields UTC (`Z`), which is a valid offset. Make `pubDate` a real `z.coerce.date()`
in the collection schema so a bad date fails the build rather than shipping. Generate the author
page from an `authors` collection so the `url` always resolves.
