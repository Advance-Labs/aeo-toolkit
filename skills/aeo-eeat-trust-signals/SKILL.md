---
name: aeo-eeat-trust-signals
description: Fix the basic trust pages and signals a site is expected to have - About page, Contact page, Privacy and Terms, HTTPS, canonical tags, and links out to authoritative sources. Use when an audit fails eeat.expertise.about-page, eeat.trust.contact-page, eeat.trust.privacy-terms, eeat.trust.https, eeat.trust.canonical-coverage or eeat.auth.outbound-references, or when someone asks about E-E-A-T, "does my site look trustworthy", "do I need an about page", or why an AI engine will not cite a site it cannot identify. Uses the aeo-visibility MCP server (analyze_website_aeo) if connected; works without it.
---

# E-E-A-T and trust signals

These six rules check that a site looks like it is run by real, reachable people who stand behind
what they publish. Passing them does not rank a page. They remove reasons for a reader, or a
quality system, to doubt the site.

**E-E-A-T is not a score Google computes.** Google's own wording: "While E-E-A-T itself isn't a
specific ranking factor, using a mix of factors that can identify content with good E-E-A-T is
useful." It also says "trust is most important. The others contribute to trust." So treat these
rules as hygiene, and never promise a ranking or citation gain from them.

## When this matters / when it doesn't

Matters most for sites where a wrong answer costs the reader something (health, money, legal),
for sites with no obvious owner, and for new sites an engine has never seen.

It does not matter much, and you should say so, when:
- The site is a personal blog or a single-purpose tool and the failing rule is only "no
  /terms page". Do not invent legal pages nobody needs. Ask whether the site collects data or
  takes payments before insisting on a privacy policy.
- The page exists under a URL the rule does not look for (see Detect). That is a false fail.
- The user wants rankings. Say plainly that these signals will not move them by themselves.

## Detect

The scoring engine (`packages/scoring/src/eeat-rules.ts`) passes each rule like this:

| Rule | Passes when |
|---|---|
| `eeat.expertise.about-page` | any crawled URL matches `/about`, `/about-us`, `/team` or `/who-we-are` (path segment, case-insensitive) |
| `eeat.trust.contact-page` | any crawled URL matches `/contact`, `/contact-us` or `/support` |
| `eeat.trust.privacy-terms` | any crawled URL matches `/privacy`, `/privacy-policy`, `/terms`, `/terms-of-service`, `/tos` or `/legal` (one is enough) |
| `eeat.trust.https` | the crawl was served over HTTPS |
| `eeat.trust.canonical-coverage` | at least 80% of crawled pages have a canonical tag |
| `eeat.auth.outbound-references` | at least 1 external link across all crawled pages |

Two consequences. The checks are **URL pattern matches, not content checks**: an empty
`/about` passes, and a real "Our story" page at `/story` fails. And they only see pages the
crawl reached, so a footer-only link on a deep page can be missed.

With the MCP server: call `analyze_website_aeo` with the site URL and read which of these IDs
fail. Without it: `curl -sI https://example.com/about` for each path, `curl -sI http://example.com`
(expect a redirect to https), and `curl -s URL | grep -i 'rel="canonical"'` on a few pages.

## Decide

| Finding | Do this |
|---|---|
| Page exists at another URL | Prefer renaming or redirecting to a standard path, or linking it from the footer so the crawl finds it. Ask before moving a URL that has inbound links. |
| Page truly missing | Write it (see Implement). Do not generate filler. |
| Site collects no personal data and takes no payment | Ask the owner whether a privacy page is wanted. A short honest one is fine. |
| Canonical coverage under 80% | Add a self-referencing canonical to every indexable template. |
| No outbound links | Cite sources where a claim needs one. Do not add links to hit the count. |

## Implement

- **About:** who runs the site, what the business is, how long it has existed, where it is, and
  real names with relevant background for people who write or review content. Google asks, in its
  helpful-content guidance, whether bylines lead to "background about them and the areas they
  write about" and whether readers can reach an About page. Never fabricate people, headshots or
  credentials: Google calls fabricated creator profiles "a form of deception".
- **Contact:** a way a human can be reached (email, form, phone, postal address if you have one).
  Use the same details as everywhere else on the web.
- **Privacy and Terms:** accurate to what the site does. Copying another company's policy is
  worse than a short true one; have the owner or a lawyer confirm for regulated businesses.
- **HTTPS:** certificate on every host, 301 from `http://` and from the non-canonical `www`
  variant, no mixed-content assets.
- **Canonical:** absolute URL, in the `<head>`, a self-reference on the canonical page itself.
  Google treats `rel=canonical` as a strong signal, not a command, and may choose another URL
  if signals conflict (redirects, sitemap, internal links). Keep those consistent.
- **Outbound references:** link to primary sources (standards, statutes, original research,
  vendor docs) at the claim they support. Use `rel="sponsored"` on paid or affiliate links and
  `rel="ugc"` on user-submitted links.
- Link About, Contact, Privacy and Terms from the site-wide footer so a crawler finds them.

Framework placement (metadata, canonical in the App Router, WordPress settings) is ordinary
site work; apply the stack's normal canonical and footer mechanism.

## Verify

Re-run `analyze_website_aeo` (or the curl checks) and confirm the six IDs above now pass. Passing
means the URL patterns resolve with a 200 and appear in the crawl. Then read the pages yourself:
a pass on an empty page is not a fix.

## Pitfalls

- Believing a pass raises rankings or guarantees citations. It does neither.
- Adding `/legal` or `/team` stub pages purely to flip a rule. The engine cannot tell, a reader
  can.
- Canonical pointing at a redirecting or non-HTTPS URL.
- A global canonical to the homepage on every page, which tells engines to ignore the site.
- Fake team members, awards or review counts. This is the quickest way to lose trust.
- Outbound links to low-quality sites to satisfy `outbound-references`.

## Sources

- Google, Creating helpful, reliable, people-first content: https://developers.google.com/search/docs/fundamentals/creating-helpful-content (verified 2026-11-13)
- Google, Consolidate duplicate URLs (canonicalization): https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls (verified 2026-11-13)
- Google, Qualify outbound links: https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links (verified 2026-11-13)
- Rule logic: `packages/scoring/src/eeat-rules.ts` in aeo-toolkit (read 2026-11-13)
