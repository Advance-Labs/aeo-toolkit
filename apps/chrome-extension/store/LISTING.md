# Listing copy, v0.3.0

**Name:** AEO/GEO Auditor

**Category:** Developer Tools  **Language:** English

**Short description** (manifest `description`, 127 chars):
Client-side AEO/GEO audit of the active tab: meta, structured data, robots.txt, sitemap, llms.txt, AI-bot rules. Exports a PDF.

**Full description** (paste as is; 44 is the rule count of this build, 31 technical SEO + 13 AEO; rules that do not apply to a page are dropped, so one audit shows up to 44 results):

```text
Audit any page for how well it answers to AI search, in one click, without sending the page
anywhere.

AEO/GEO Auditor runs 44 checks across 9 categories against the tab you are looking at, then
gives you a 0 to 100 AI-readiness score with a letter grade and a filterable list of what to
fix. Every check runs inside your browser.

WHAT IS AEO, AND HOW IS IT DIFFERENT FROM SEO?

Answer Engine Optimization is what decides whether ChatGPT, Perplexity, Claude, and Google's
AI Overviews can read your page, understand it, and cite it. Classic SEO gets you ranked in a
list of links. AEO gets you quoted in an answer. The signals overlap but they are not the
same: an answer engine cares about whether your markup identifies who wrote something, whether
your content is extractable as discrete answers, and whether your robots.txt lets its crawler
in at all.

WHAT IT CHECKS

Crawlability. robots.txt rules, and specifically whether AI crawlers such as GPTBot,
PerplexityBot, and ClaudeBot are permitted or blocked.

Crawl hints. sitemap.xml presence and whether its lastmod dates are trustworthy, plus llms.txt,
the emerging convention for telling answer engines what a site is about.

Structured data. JSON-LD validity, and whether Organization, Article with a Person author,
FAQPage, BreadcrumbList, and Speakable markup are present. Nested @graph structures are read at
any depth, so markup done the way Google documents it is scored correctly.

Indexing and metadata. Canonicals that point somewhere real, unique titles, title and
description length, one H1 per page, valid heading hierarchy, declared language.

Answer engine optimization. Whether headings are question-shaped, whether content is answerable
with enough depth, whether Organization identity is consistent across pages, and whether the
page is extractable as paragraphs plus lists and tables.

Content, social, mobile, security. Alt-text coverage that understands alt="" is the correct
markup for a decorative image, internal linking, thin-content detection, OpenGraph and Twitter
Card completeness, viewport, and HTTPS.

Checks that do not apply to a page are dropped rather than failed. A homepage is the root of a
breadcrumb trail and is not an article, so it is not marked down for lacking either.

PRIVACY

Nothing leaves your browser. There is no account, no server, no analytics, and no telemetry.
The only network requests are to the audited site's own robots.txt, sitemap.xml, and llms.txt,
which is why the extension asks for host permissions. Your audit history is not stored anywhere
because it is not stored at all.

EXPORT

Export any audit as a PDF, generated locally, for handing to a client or a colleague.

OPEN SOURCE

The scoring engine is Apache-2.0 licensed and public at
github.com/Advance-Labs/aeo-toolkit. Every check is a rule you can read.

Built by Advance Labs.
```

**What's new in 0.3.0:**
A redesigned popup: light concrete look, clearer score and grade, pass and fail marks that read
at a glance, and a more compact layout that fits the popup without scrolling. New icons. The
audit rules, permissions and data handling are unchanged.

**Permissions:** unchanged (`activeTab`, `scripting`, `<all_urls>` host access for the audited
site's own robots.txt, sitemap.xml and llms.txt). Privacy policy: https://advancelabs.dev/privacy/aeo-auditor
