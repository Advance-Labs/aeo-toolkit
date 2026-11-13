---
name: aeo-organization-entity
description: Publish one consistent Organization (or Person) entity in JSON-LD, with a stable @id, logo and sameAs links, so answer engines can tell who is behind a site. Use when someone asks to add Organization schema, fix "Organization schema missing" or "organization identity inconsistent" audit findings, set up sameAs or a Wikidata/Knowledge Graph presence, make ChatGPT or Perplexity recognise their brand, or stop two subdomains describing the same company differently. Covers aeo.organization-schema, aeo.entity-identity-consistent and eeat.auth.organization-schema. Uses the aeo-visibility MCP server if connected; works without it.
---

# One organization, described the same way everywhere

Organization markup tells engines which real-world entity owns a site: its name, its URL, its
logo, and the other places it exists online (`sameAs`). The audit passes when an Organization is
present, and fails a separate rule when two first-party nodes contradict each other. The
second failure is the more damaging one and the easier one to cause.

## When this matters / when it doesn't

**It matters** for any site that represents a company, product, publication or institution,
especially one with several subdomains or several apps that each ship their own markup.

**It matters less than you might think for rich results.** Google's Organization documentation
lists no required properties, and says the markup does not need to be on every page; the
homepage or a single About page is enough. Do not promise a visible search feature from it.
What it buys is disambiguation: a consistent entity with corroborating `sameAs` links is
easier for a model or knowledge graph to resolve and attribute.

**It is not the right entity when the site is a person.** A personal portfolio, a freelancer or
a solo author blog is about a `Person`. Marking a person up as `Organization` is wrong, and
Google's author guidance says not to use the wrong type. Use a `Person` node with the same
`@id` and `sameAs` discipline, and drop the Organization.

**Do not invent facts to fill the schema.** No `sameAs` link to a profile that does not exist,
no `foundingDate` you are guessing at, no logo the company does not use.

## Detect

Rules this skill owns, and what they actually check:

| Rule | Passes when |
|---|---|
| `aeo.organization-schema` | Any crawled page has a node whose type is `Organization` or `LocalBusiness` (found at any nesting depth, JSON-LD, Microdata or RDFa). |
| `eeat.auth.organization-schema` | Same detection, in the E-E-A-T pillar. |
| `aeo.entity-identity-consistent` | Fewer than two first-party `Organization` nodes exist, or all of them share one `@id` and one `url`. |

Details that change how you read a result:

- **Subtypes are not all detected.** `Corporation`, `NGO`, `NewsMediaOrganization`,
  `OnlineBusiness` and the other schema.org subtypes are valid, but the audit only counts the
  exact short type `Organization` plus `LocalBusiness`. A site marked up as `@type: "Corporation"`
  alone can fail the presence rule while being correct schema.org. Declaring a type array such as
  `["Organization", "Corporation"]` satisfies presence, but the consistency rule compares only
  nodes whose type is exactly `Organization`, so such a node is skipped there.
- **"First-party" means the host matches.** Nodes whose `@id` or `url` is on another domain
  (a client on a case-study page) are ignored by the consistency rule. Subdomains of the
  audited host count as the same site, which is the point: `app.example.com` and `example.com`
  must agree.
- **`@id` comparison keeps the fragment.** `/#organization` and `/#org` are different ids and
  the rule reports that as a conflict. A trailing-slash or `www` difference in `url` is
  normalised, so those alone are not a failure.
- A missing `@id` is not reported by the consistency rule. Add one anyway.

With the MCP server: call `analyze_website_aeo` on the homepage and a second subdomain if there
is one, and read the three rule results. The `detail` string on the consistency rule says
whether the disagreement is in `@id` or `url`.

Without it, fetch each page and list the Organization nodes:

```bash
curl -s https://example.com/ | grep -o '<script type="application/ld+json">.*' | head
# or run the toolkit's validator over saved HTML:
curl -s https://example.com/ -o page.html
npm i @advance-labs/schema-validator   # in a scratch directory
node --input-type=module -e "
import { analyzeStructuredData } from '@advance-labs/schema-validator';
import { readFileSync } from 'node:fs';
const r = analyzeStructuredData(readFileSync('page.html', 'utf8'), 'https://example.com/');
console.log(JSON.stringify(r.items, null, 2));"
```

Run it against the homepage of every host that belongs to the company, then compare `@id`,
`url` and `name` by eye.

## Decide

| Situation | Do this |
|---|---|
| No Organization anywhere | Add one node on the homepage (and About page if you like). |
| Organization present, one host | Add `@id`, `logo`, `sameAs` if missing. Nothing else needed. |
| Several hosts or apps, differing `@id` or `url` | Pick one canonical entity (almost always the apex marketing site). Every other host references that `@id` rather than redefining the company. |
| A product or app is genuinely a separate company or brand | Give it its own `@id` and mark `parentOrganization` to the main entity. Say so to the user: this is a modelling decision, not a bug. |
| Site is a person's own | `Person`, not `Organization`. |
| You are not sure whether subdomains are one entity | Ask. Do not merge two legal entities into one node to satisfy a rule. |

## Implement

Shape of the fix, independent of stack:

1. Choose the canonical `@id`: the homepage URL plus a fragment, `https://example.com/#organization`.
   It is an identifier, not a page; it does not have to resolve and must never change.
2. Publish the full node once, on the homepage (and optionally the About page), in JSON-LD.
3. On every other page and host, either emit nothing about the organization, or emit a minimal
   reference that reuses the same `@id`. Never emit a second full definition with a different
   `@id`, `url` or `name`.
4. Put the node in a connected `@graph` with the `WebSite` and the page, so `publisher`,
   `isPartOf` and `author` can point at it by `@id`.
5. Generate it from one source of truth (one config object), so the value cannot drift between
   apps.

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://example.com/#organization",
      "name": "Example Corporation",
      "legalName": "Example Corporation Inc.",
      "url": "https://example.com/",
      "logo": {
        "@type": "ImageObject",
        "@id": "https://example.com/#logo",
        "url": "https://example.com/images/logo-512.png",
        "contentUrl": "https://example.com/images/logo-512.png",
        "width": 512,
        "height": 512
      },
      "image": { "@id": "https://example.com/#logo" },
      "description": "One factual sentence about what the company does.",
      "sameAs": [
        "https://www.linkedin.com/company/example",
        "https://github.com/example",
        "https://www.crunchbase.com/organization/example",
        "https://www.wikidata.org/wiki/Q0000000"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://example.com/#website",
      "url": "https://example.com/",
      "name": "Example Corporation",
      "publisher": { "@id": "https://example.com/#organization" }
    }
  ]
}
```

Property notes, from Google's Organization documentation:

- `name` should match the site name you use elsewhere; `alternateName` for a short form.
- `logo`: at least 112x112 px, a crawlable and indexable URL, in a format Google Images
  supports, and legible on a plain white background. Use a raster or SVG file that exists.
- `sameAs`: pages on other sites that are really about this organization (social, review,
  registry, Wikipedia, Wikidata). Include only profiles that exist and that the company controls
  or that clearly describe it.
- `address`, `telephone`, `email`, `vatID`, `iso6523Code` are recommended when true and public.
  Do not add them to look complete.
- Use the most specific subtype that is accurate (`OnlineStore`, `NGO`, `Corporation`), but see
  the detection caveat above: keep `Organization` in a type array if you want the audit to count
  it.

A node on a subdomain that only points back:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": "https://app.example.com/#website",
      "url": "https://app.example.com/", "name": "Example App",
      "publisher": { "@id": "https://example.com/#organization" } }
  ]
}
```

Whether an engine will resolve a bare `{ "@id": ... }` reference across hosts it has not
crawled together is not guaranteed. Where it matters, repeat the same `name`, `url` and
`@id` verbatim in a short node on the subdomain rather than relying on a bare reference.
Identical beats clever.

### Wikidata and the Knowledge Graph

Wikidata is a public database engines and Google's knowledge systems draw on, and `sameAs`
to a Wikidata item is a strong disambiguation link. You cannot rank into it by markup:

- Do not create a Wikidata item or a Wikipedia article for a company that does not meet the
  notability criteria (an item needs a Wikimedia sitelink, a clearly identifiable entity with
  serious public references, or a structural need). Self-promotional entries get deleted and
  can hurt more than help.
- If an item already exists for the company, add its `https://www.wikidata.org/wiki/Q...` URL to
  `sameAs`. If you are unsure whether it is the right item, ask the user.
- Google does not promise a Knowledge Panel for any markup. Treat it as an outcome, not a task.

Stack recipes: read `references/nextjs.md`, `references/astro.md`, `references/wordpress.md`
or `references/static-html.md` for the one that matches the project.

## Verify

1. Re-run `analyze_website_aeo` (or the validator command above) on the homepage and on every
   other host.
2. `aeo.organization-schema` and `eeat.auth.organization-schema` should be `pass`.
3. `aeo.entity-identity-consistent` should be `pass`. If it still fails, read the detail: it
   names `@id` or `url`. Search the HTML of each host for the odd value out, including
   plugin-injected blocks.
4. Paste the homepage URL into the Rich Results Test and the Schema Markup Validator; confirm
   no errors on the Organization node. Warnings about missing recommended properties are
   acceptable.
5. Confirm the logo URL returns an image with a 200 and is not blocked by robots.txt.

Passing means the markup is present and self-consistent. It does not mean any engine has
connected the entity yet; that shows up, if at all, in `check_ai_visibility` over weeks.

## Pitfalls

- **Two plugins, two Organizations.** An SEO plugin and a theme or schema plugin each emit one,
  with different ids. See `aeo-structured-data-validation`.
- **`@id` that is a page URL.** Using `https://example.com/` as the Organization `@id` collides
  with the `WebPage` or `WebSite` node for the same URL. Always use a fragment.
- **Changing the `@id` later.** Treat it like a primary key.
- **`www` and apex disagreeing.** Redirect one to the other; set `url` to the canonical host.
- **Per-page generated values.** `url` set to the current page URL instead of the site root makes
  every page claim a different organization.
- **Logo that is a wordmark on transparent PNG.** It fails the white-background guidance.
- **Setting `sameAs` to the company's own pages.** That corroborates nothing.
- **Claiming to be a `LocalBusiness`** to get detected. Only use it if the business serves a
  physical location.

## Sources

- Google, Organization structured data: https://developers.google.com/search/docs/appearance/structured-data/organization (verified 2026-11-13)
- Google, general structured data guidelines: https://developers.google.com/search/docs/appearance/structured-data/sd-policies (verified 2026-11-13)
- Google, article author markup guidance (right type for people vs organizations): https://developers.google.com/search/docs/appearance/structured-data/article (verified 2026-11-13)
- schema.org Organization: https://schema.org/Organization (verified 2026-11-13)
- schema.org Person: https://schema.org/Person (verified 2026-11-13)
- Wikidata notability policy: https://www.wikidata.org/wiki/Wikidata:Notability (verified 2026-11-13)
- Toolkit detection logic: `packages/scoring/src/aeo-rules.ts`, `packages/schema-validator/src/analyze.ts`
