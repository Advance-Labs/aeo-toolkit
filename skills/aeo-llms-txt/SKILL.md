---
name: aeo-llms-txt
description: Create, fix or decide whether to publish an llms.txt file (and llms-full.txt) for a site. Use when someone asks "add llms.txt", "do I need llms.txt", "does ChatGPT read llms.txt", "generate llms.txt", "llms.txt showing up in Google", or when the audit fails tech.llms-txt-present or aeo.llms-txt-present. Covers the llmstxt.org format, honest adoption status, serving it with noindex, and generating it from source instead of by hand. Uses the aeo-visibility MCP server if connected; works without it.
---

# llms.txt

`llms.txt` is a Markdown file at your site root that gives language models a short, curated map
of your content. It is cheap to publish. **No major answer engine has confirmed that it reads
it for ranking or citation**, so treat it as low-cost groundwork, not a lever. Say that to the
user before they expect traffic from it.

## When this matters / when it doesn't

Worth doing when:

- The site is developer docs or an API reference. This is where the file is actually used:
  coding agents fetch it to find the right pages, and the spec's own author says documentation
  is its heaviest use.
- You already generate content from structured sources, so producing the file is nearly free.
- A tool or agent your users run is known to read it (some documentation platforms and agent
  tools do). Ask which.

Not worth much effort when:

- The goal is "show up in ChatGPT / Google AI Overviews". Google's John Mueller has said
  publicly (June 2025, repeated since) that no AI system currently uses llms.txt, and Google's
  AI features guidance says there are no extra requirements to appear in AI Overviews beyond
  normal SEO. Do not promise a result. Time spent on server rendering, bot access and answer-first
  content pays back far more (`aeo-server-rendering`, `aeo-ai-crawler-access`, `aeo-answer-first-content`).
- The site is five pages. A sitemap and good headings already say the same thing.

The audit still scores the file (see Detect). Passing the rule and the file being used are
different things; be straight about that when reporting.

## Detect

Rules owned: `tech.llms-txt-present` and `aeo.llms-txt-present`. Both pass when `/llms.txt`
answers 2xx with a non-HTML content type. The crawler also probes `/llms-full.txt` and records
it, but no rule scores it. An SPA that answers `/llms.txt` with its HTML shell fails, which is
correct: that is not the file.

With the MCP server: `analyze_website_aeo` returns the crawl-hint files it found.

Without it:

```bash
curl -sI https://example.com/llms.txt | head -8     # 200, content-type text/plain or text/markdown
curl -s  https://example.com/llms.txt | head -20    # starts with "# Site name"
curl -sI https://example.com/llms.txt | grep -i x-robots-tag
```

## Decide

1. **Should we publish one?** If the answer is "to get cited", explain the evidence above and let
   the owner decide. Publishing is harmless, just not a priority.
2. **Site-wide or per-section?** The spec allows `/llms.txt` or a file at any subpath (for
   example `/docs/llms.txt` covering only `/docs/`). When several apply, agents should use the
   most specific one. A big site with one documentation area can start there.
3. **Is `llms-full.txt` needed?** It is a common convention (one file holding the full text of
   the key pages) used by documentation platforms, but the current llmstxt.org spec page does not
   define it. Only add it for docs sites, and generate it, never hand-write it. A multi-megabyte
   file defeats the point of a short map.

## Implement

**Format** (llmstxt.org, current version). A Markdown file with these parts, in order:

1. An H1 with the site or project name. **The only required part.**
2. A blockquote with a short summary.
3. Optional paragraphs or lists of any kind except headings, with more detail.
4. Zero or more H2 sections, each a list of `- [Link title](url): optional notes`.

An H2 named `Optional` is, by convention, secondary material an agent can skip when it needs a
shorter context. The proposal also suggests serving a clean Markdown version of pages at the
same URL plus `.md`, and linking it with `rel="alternate" type="text/markdown"`.

```markdown
# Example Co

> Example Co makes invoicing software for small agencies in Canada.

Pricing is per seat, billed monthly in CAD. Docs are versioned; prefer the latest.

## Docs
- [Quickstart](https://example.com/docs/quickstart): Create an account and send a first invoice
- [API reference](https://example.com/docs/api): REST endpoints and auth

## Policies
- [Pricing](https://example.com/pricing): Plans and what each includes

## Optional
- [Changelog](https://example.com/changelog)
```

Rules of thumb that follow from the format: only list URLs that return 200 and are canonical;
write link notes a person could act on; keep it short enough to fit comfortably in a context
window; never put marketing copy in the summary.

**Generate it from source. Do not hand-maintain it.** A hand-written file goes stale the first
time a page moves, and the audit will not tell you. Build it in the same step that builds your
sitemap, from the same content list, so the two cannot disagree. Where a manifest of pages
already exists (CMS, MDX frontmatter, route list), loop over it. Per-stack code:
`references/nextjs.md`, `references/astro.md`, `references/static-html.md` (also WordPress).

The Advance Labs `create-llms-txt` npm package (`npm create llms-txt`) writes a starter file by
reading a project's routes, supports Next, Astro, SvelteKit, Nuxt, WordPress themes and plain
HTML, and never overwrites an existing file. It is separate from this toolkit's packages and its
output is a starting point: review the summary and prune it. Its output includes extra sections
beyond the minimal format above.

**Serve it with `X-Robots-Tag: noindex`.** Otherwise Google can index the file, and because it
repeats your page titles and descriptions it can compete with the real pages in results. We saw
this on advancelabs.dev: our own `/llms.txt` was showing up for queries that our llms.txt
guide pages should have won. John Mueller has said that noindex for it "could make sense",
because sites may link to it and it could otherwise be indexed, which would be odd for users.
That is advice, not a rule, and it is a trade-off, not a requirement: noindex only affects search
indexes. it does not stop an AI agent fetching and reading the file, and the file's purpose is not search.

- Use the HTTP header, since a `.txt` file has no `<head>` for a meta tag.
- Do **not** also `Disallow: /llms.txt` in robots.txt. Blocking it hides the file from the agents
  you wrote it for, and a crawler that cannot fetch the file cannot see the noindex either.
- Content type: `text/plain; charset=utf-8` or `text/markdown`. Not `text/html`.

## Verify

1. `curl -sI https://example.com/llms.txt` shows `200`, a non-HTML content type, and
   `x-robots-tag: noindex`.
2. Every link in the file resolves: `grep -o 'https\?://[^) ]*' llms.txt | sort -u | xargs -n1 curl -s -o /dev/null -w "%{http_code} %{url}\n"` shows no 3xx/4xx.
3. Re-run `analyze_website_aeo`. Both llms.txt rules pass.
4. After a content change and rebuild, the file changed with it. If it did not, generation is not wired in.
5. In Search Console, `gsc_url_inspect` on `https://example.com/llms.txt` after Google recrawls should show
   it is excluded by noindex. It can take weeks.

## Pitfalls

- A catch-all SPA route returning the app shell for `/llms.txt`.
- Hand-maintained files that rot. Generate.
- Listing noindex, redirected or 404 URLs. The file should point only at pages you want read.
- Treating it as a robots.txt substitute. It permits nothing and blocks nothing.
- Putting private or paywalled URLs in the file.
- Making `llms-full.txt` enormous. Include the pages that answer real questions, not the site.
- Over-claiming. "We added llms.txt, so AI will find us" is not supported by evidence.

## Sources

- llmstxt.org specification, v2, modified August 10, 2026 (format, subpath files, "Optional" section, `.md` page variants; the page does not define llms-full.txt): https://llmstxt.org/ (verified 2026-11-13)
- John Mueller on llms.txt and noindex, as reported by Search Engine Roundtable (primary post is on Bluesky and could not be fetched here): https://www.seroundtable.com/google-noindex-llms-txt-39798.html and https://www.seroundtable.com/google-ai-llms-txt-39607.html (verified 2026-11-13 via search results and one page fetch; secondary reporting)
- Google, AI features and your website (no additional requirements for AI Overviews): https://developers.google.com/search/docs/appearance/ai-features (verified 2026-11-13)
- npm package `create-llms-txt` 1.0.0 (published 2026-09-24 by Advance Labs Inc.): https://www.npmjs.com/package/create-llms-txt (verified 2026-11-13 via the npm registry)
- Adoption claims in the llmstxt.org page (thousands of sites, OpenAI/Anthropic/Gemini publishing their own) are the spec author's, not independently checked.
