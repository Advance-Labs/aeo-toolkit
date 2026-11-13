---
name: aeo-server-rendering
description: Make sure a page's real content is in the HTML the server sends, not built by JavaScript afterward. Use when someone asks "why can't ChatGPT or Perplexity read my site", "AI crawlers see an empty page", "do I need SSR for AEO", "my React or Vite SPA isn't being cited", "prerender my site", "view source is empty", or when the audit fails aeo.content-server-rendered. Covers testing with curl, SSR/SSG/prerender per framework, and content that only appears after hydration (tabs, accordions, client-fetched text). Uses the aeo-visibility MCP server if connected; works without it.
---

# Content must be in the initial HTML

Many AI crawlers read the HTML they are given and do not run JavaScript. If a page is an empty
`<div id="root">` until a script fills it, those crawlers see nothing to cite. The fix is to send
the content in the first response: server-render it, generate it at build time, or prerender it.

## When this matters / when it doesn't

It matters for any page you want cited: articles, docs, product and pricing pages, about pages.

It matters less, or not at all, for:

- Logged-in app screens, dashboards, checkout. Nobody expects those to be cited.
- Interactive widgets on an otherwise server-rendered page (a calculator, a chat bubble). Their
  absence from the HTML is fine. The surrounding text is what counts.
- **Googlebot specifically.** Google says it renders JavaScript with an evergreen Chromium, after
  a queue. A client-rendered page can rank on Google and still be invisible to other crawlers.
  Do not tell someone their site is "not indexed" because of this finding: the claim is about
  AI crawlers and other engines, not Google.

How sure are we that AI crawlers skip JavaScript? The main public evidence is a Vercel and MERJ
analysis from December 2024, which found no JavaScript execution from OpenAI's crawlers
(including OAI-SearchBot and ChatGPT-User), ClaudeBot, Meta's crawler or Bytespider. It does not
show PerplexityBot's behaviour. Crawlers change, and none of the vendors guarantee either
behaviour. Server-rendering is cheap insurance, not a proven requirement for every engine.

## Detect

Rule owned: `aeo.content-server-rendered`. It fails when a page has **both**:

1. An empty app shell: a known mount point (`#root`, `#app`, `#__next`, `#__nuxt`, `#nuxt`, `#___gatsby`, `#q-app`, `#svelte`, `[data-reactroot]`, `[data-server-rendered]`) with no visible text
   (3 words or fewer), **and at least one `<script>` on the page**.
2. A word count under 100 in the served HTML.

It deliberately does not fail a short server-rendered page, and it does not flag thin content
(that is `tech.content-not-thin`, which needs the opposite fix: write more, not render
differently). If both rules fail on the same URL, fix rendering first.

With the MCP server: call `analyze_website_aeo` and read the detail line for the failing URL.

Without it, compare what the server sends with what a browser shows:

```bash
# What a non-JS crawler sees
curl -s https://example.com/pricing | sed -e 's/<script[^>]*>.*<\/script>//g' | head -80
# Is a phrase you can see in the browser present in the raw HTML?
curl -s https://example.com/pricing | grep -ci "your exact visible headline"
# Word count of the served HTML (rough)
curl -s https://example.com/pricing | sed -e 's/<[^>]*>/ /g' | wc -w
```

`0` matches, or a body that is only `<div id="root"></div>` plus scripts, confirms it. View
Source in a browser (not Inspect Element, which shows the rendered DOM) shows the same thing.
Do it for a few page types, not just the home page: marketing pages are often fine while the
blog or docs are client-rendered.

## Decide

First, **what is client-rendered and does it matter?** Ask the user which pages must be
citable. Then pick the least invasive fix:

| Situation | Fix |
|---|---|
| Framework supports SSR/SSG (Next.js, Astro, Nuxt, SvelteKit, Remix) but a page opted out | Remove the opt-out: render on the server |
| Content known at build time (blog, docs, marketing) | Static generation (SSG). Cheapest and fastest |
| Content changes often but is public | SSR, or SSG with revalidation |
| Vite/CRA single-page app with few public pages | Prerender those routes at build time |
| Large existing SPA, no appetite to migrate | Prerender service/dynamic rendering as a stopgap, or move public pages to a static site and keep the app for logged-in use |
| Text fetched in `useEffect` from an API | Fetch on the server and pass it down (or in a server component) |
| Tabs/accordions whose hidden panels are only mounted on click | Render all panels in HTML, hide with CSS or `<details>` |

Google lists dynamic rendering as a workaround, not a recommendation. Prefer SSR/SSG/prerender
built from the same code the users get, so the two copies never drift apart.

## Implement

Stack-agnostic shape:

1. Make the framework produce HTML for the route at build or request time.
2. Move data fetching for visible text to the server side of that route.
3. Keep browser-only code (`window`, `localStorage`, charts) behind client-only boundaries
   so it does not break server rendering.
4. Render collapsed content into the markup; hide it visually, do not omit it.
5. Put the main text, headings, and structured data (JSON-LD) in the served HTML, not injected later.

Then read the recipe for the stack: `references/nextjs.md`, `references/astro.md`, or
`references/static-html.md` (covers plain HTML and Vite/React SPAs).

## Verify

1. Re-run the `curl | grep` check above. The headline and body text appear in the raw HTML.
2. Re-run `analyze_website_aeo`; `aeo.content-server-rendered` passes. Check `tech.content-not-thin`
   did not newly fail (it can after rendering changes the word count).
3. Spot-check three page types, including one deep URL (not only `/`), and a page with tabs or
   accordions.
4. Hydration still works: open the page in a browser, no console errors, interactive parts respond.

## Pitfalls

- **Inspect Element is not View Source.** The first shows the post-JavaScript DOM and will
  mislead you.
- Server-rendering the shell but not the data: the page has a header and footer in the HTML,
  so it is not an "empty shell", yet the article body is still fetched by the client. The rule
  may pass while the page is still empty of content. Check the body text with the grep above.
- Hydration mismatches when server and client output differ (dates, random ids, `window`
  checks). Fix the mismatch; do not suppress the warning and ship.
- Prerendering at build time makes a snapshot. If content changes between builds, set a rebuild
  or revalidate schedule.
- A prerender service (dynamic rendering) that serves bots different HTML from users can drift
  into cloaking if the content differs. Keep the output equivalent.
- Lazy-loaded below-the-fold text that loads on scroll never loads for a crawler. Google has a
  page on fixing lazy-loaded content.
- Do not conclude "AI cannot see my site" from this rule alone. If robots.txt or a CDN blocks
  the bots, rendering is irrelevant. Check `aeo-ai-crawler-access` first when nothing at all is fetched.

## Sources

- Google, JavaScript SEO basics (Googlebot renders JS with an evergreen Chromium; crawl, render, index queue): https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics (verified 2026-11-13)
- Vercel and MERJ, "The rise of the AI crawler" (December 2024; AI crawlers do not render JavaScript). Reached through a search result summary, the full article was not fetched. https://vercel.com/blog/the-rise-of-the-ai-crawler (verified 2026-11-13 via search only)
- Toolkit rule implementation: `packages/scoring/src/aeo-rules.ts` (`aeo.content-server-rendered`) and `packages/html-parser/src/content.ts` (`detectEmptyAppShell`).
