---
name: aeo-article-author-schema
description: Mark up articles and blog posts with Article, BlogPosting or TechArticle JSON-LD whose author is a real Person linked to an author page, with datePublished, dateModified and a publisher that points at the organization. Use when someone asks to add article schema, author markup, byline or author bio schema, fix "article and author schema missing", "author not identified" or "Person schema" audit findings, or improve E-E-A-T attribution for blog and docs content. Covers aeo.article-author-schema, eeat.expertise.person-schema and eeat.expertise.article-markup. Uses the aeo-visibility MCP server if connected; works without it.
---

# Articles with a named, linkable author

Article markup says "this page is a piece of writing"; the author node says who wrote it and
where that person can be verified. Together they give an engine something to attribute a quote
to. The markup must describe what is visibly on the page: a real byline, real dates.

## When this matters / when it doesn't

**It matters** for blog posts, guides, docs articles, news and research: pages where a named
person or the organization stands behind the content.

**It does not apply to** homepages, product pages, pricing, landing pages or tool pages.
Marking those up as `Article` to satisfy an audit is misleading markup. The audit knows this:
`aeo.article-author-schema` is skipped when a single-page audit targets the site root. If the
site has no editorial content at all, the honest answer is "this does not apply", not "add a
fake blog post".

**An author is not required for the markup to be valid.** Google's Article documentation lists
no required properties. `author` is recommended, and it can be an `Organization` when the
content is genuinely published by the company with no individual byline. Do not invent a
person to fill the field, and do not credit a real person who did not write the piece.

**AI-generated or ghostwritten content** needs a human decision about who is credited. Ask the
user; do not choose a name.

## Detect

| Rule | Passes when |
|---|---|
| `aeo.article-author-schema` | Across the crawled pages, at least one `Article`-family node exists **and** at least one `Person` node exists. |
| `eeat.expertise.article-markup` | At least one Article-family node exists. |
| `eeat.expertise.person-schema` | At least one `Person` node exists. |

What that really means:

- "Article-family" is `Article`, `NewsArticle`, `BlogPosting`, `TechArticle`, `ScholarlyArticle`,
  `Report`, `APIReference` and the other schema.org subtypes of Article. `TechArticle` counts
  for presence.
- Detection is **at any nesting depth**, so `author: { "@type": "Person" }` inside the Article
  satisfies the Person check.
- The rules are **site-wide ORs, not per-page**. A Person anywhere (a founder on the About
  page) plus an Article anywhere passes `aeo.article-author-schema`, even if no article is
  attributed to anyone. The audit passing does not prove the author is linked to the article.
  Check that yourself.
- The toolkit's validator requires `headline` on `Article`, `NewsArticle` and `BlogPosting`, and
  `name` on `Person`. A missing one marks the item invalid (`tech.structured-data-valid`).
  `TechArticle` has no required-property check in the validator, so a headline-less TechArticle
  is not flagged. Include `headline` anyway.

With the MCP server: `analyze_website_aeo` on a sample article URL (not only the homepage), then
read the three rules and the structured-data detail.

Without it: view-source an article, find the `ld+json` blocks, and answer these in order: is
there an Article-family node; does it have an `author`; is the author a `Person` with `name`
and a `url` or `sameAs`; does that URL resolve to a real author page; are both dates present
and ISO 8601; does `publisher` reference the Organization `@id`.

## Decide

| Situation | Do this |
|---|---|
| Posts have a visible byline linking to an author page | Person node with `url` to that page and `sameAs` to external profiles. |
| Byline exists, no author page | Create a short author page (name, role, bio, links) before marking it up; or link the best existing profile via `sameAs`. Ask the user which. |
| Posts are published as the company, no byline | `author` is the Organization (`{"@id": ".../#organization"}`). |
| Multiple authors | One `author` array entry per person. Never one entry with "A, B". |
| Guest post | The guest is the `author`; the site is the `publisher`. |
| Docs or API reference page | `TechArticle` (or `Article`). Same author rules. |
| Page is a changelog or release note | `Article` is fine; do not use `NewsArticle` unless it is news. |
| Dates are unknown | Omit them rather than guessing. Do not set `dateModified` to today on every build. |
| Homepage or landing page | Do nothing. Not an article. |

## Implement

Shape, independent of stack:

1. One `Person` node per author, defined once on that author's page with a stable `@id`
   (`https://example.com/authors/jane-doe#person`). Give it `name`, `url` (the author page),
   `sameAs` (LinkedIn, GitHub, personal site, ORCID if relevant), and `jobTitle` and
   `worksFor` if true and shown on the page.
2. Each article references that person by `@id` in `author`, and the organization by `@id` in
   `publisher`. Also set `mainEntityOfPage` to the page and `isPartOf` to the `WebSite`.
3. `datePublished` and `dateModified` in ISO 8601 with a timezone offset
   (`2026-11-13T09:00:00-05:00`). Google recommends the offset; without it the timezone of
   Googlebot is assumed. The dates must match the visible ones.
4. `image`: relevant article images, crawlable URLs, ideally in 16:9, 4:3 and 1:1.
5. Generate all of it from the same post data that renders the byline, so they cannot diverge.

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BlogPosting",
      "@id": "https://example.com/blog/answer-engines#article",
      "headline": "How answer engines choose what to cite",
      "description": "A one-sentence summary that matches the meta description.",
      "mainEntityOfPage": { "@id": "https://example.com/blog/answer-engines" },
      "url": "https://example.com/blog/answer-engines",
      "datePublished": "2026-11-13T09:00:00-05:00",
      "dateModified": "2026-11-20T14:30:00-05:00",
      "image": ["https://example.com/img/answer-engines-16x9.jpg"],
      "author": { "@id": "https://example.com/authors/jane-doe#person" },
      "publisher": { "@id": "https://example.com/#organization" },
      "isPartOf": { "@id": "https://example.com/#website" }
    },
    {
      "@type": "Person",
      "@id": "https://example.com/authors/jane-doe#person",
      "name": "Jane Doe",
      "url": "https://example.com/authors/jane-doe",
      "jobTitle": "Head of Research",
      "worksFor": { "@id": "https://example.com/#organization" },
      "sameAs": [
        "https://www.linkedin.com/in/janedoe",
        "https://github.com/janedoe"
      ]
    }
  ]
}
```

The Organization node (`/#organization`) and `WebSite` node are defined on the homepage; see
`aeo-organization-entity`. If a referenced `@id` is not defined on the same page, a validator
cannot see what it points to, and some engines will not follow it. Where that matters, include
the Organization node in the same graph on the article page too, with identical values.

Google's author guidance, which the markup must follow:

- `author.name` is **only the name**. No job title, no "Posted by", no honorifics, no publisher
  name; those have their own properties (`jobTitle`, `honorificPrefix`, `publisher`).
- Use `Person` for people and `Organization` for organizations. Do not use the wrong one or `Thing`.
- List every author shown on the page, each as its own entry.
- `author.url` should link to a page that uniquely identifies the author (author page, social
  profile). `sameAs` is accepted as an alternative and Google understands both when
  disambiguating. For an author page on your own site, Google suggests marking it up with
  `ProfilePage` structured data; that is optional and has its own documentation.

Author page: a real, crawlable page at the `url`, with the person's name, a short bio, a
photo and links to the posts. The `Person` node is defined there. It should be linked from
the bylines, in the sitemap and not `noindex`.

Stack recipes: `references/nextjs.md`, `references/astro.md`, `references/wordpress.md`,
`references/static-html.md`.

## Verify

1. Re-run `analyze_website_aeo` on an article URL (or the validator on its HTML).
2. The three rules above should be `pass`. If only the Person rule fails, the author is a bare
   string (`"author": "Jane Doe"`); convert it to a `Person`.
3. Rich Results Test and Schema Markup Validator on the article URL: no errors; warnings for
   missing recommended properties are acceptable.
4. Open the page and compare, field by field, to the markup: headline, byline, dates, image.
   Any mismatch is a defect even if the validators are happy.
5. Click the author `url`; it must return 200, be indexable and show the same name.

## Pitfalls

- **`"author": "Jane Doe"` as a string.** Valid for some consumers, but it is not a Person node,
  so the Person rules fail and there is nothing to link.
- **Author pages that 404, are `noindex` or are blocked in robots.txt.**
- **`dateModified` bumped on every deploy.** Engines and users read it as a freshness claim.
  Change it only when the content changed. See `aeo-content-freshness`.
- **Dates without a timezone offset** shift by hours in other zones.
- **Two Article blocks on one page** from a theme and an SEO plugin, with different authors or
  dates. See `aeo-structured-data-validation`.
- **A whole site marked `NewsArticle`.** Use it for news. `Article` or `BlogPosting` otherwise.
- **Fake authors, stock photos, invented credentials.** This is the opposite of E-E-A-T and
  violates Google's guideline against misrepresenting who is behind the content.
- **Marking up the homepage as an Article** to pass the rule.

## Sources

- Google, Article structured data (no required properties; author, dates, best practices): https://developers.google.com/search/docs/appearance/structured-data/article (verified 2026-11-13)
- Google, general structured data guidelines: https://developers.google.com/search/docs/appearance/structured-data/sd-policies (verified 2026-11-13)
- schema.org Article, BlogPosting, TechArticle, Person: https://schema.org/Article , https://schema.org/BlogPosting , https://schema.org/TechArticle , https://schema.org/Person (verified 2026-11-13)
- Toolkit logic: `packages/scoring/src/aeo-rules.ts`, `packages/scoring/src/eeat-rules.ts`, `packages/schema-validator/src/analyze.ts`, `validation.ts`
