---
name: aeo-answer-first-content
description: Restructure existing pages so an answer engine can lift a clean answer out of them, without wrecking the author's voice. Use when someone asks why ChatGPT, Perplexity or Google AI Overviews don't quote their page, how to write for AI answers, how to structure a post for featured snippets, whether to add FAQ-style or question headings, why a page is flagged as thin, has no headings, has two H1s or skips heading levels, or when an audit fails aeo.question-headings, aeo.answerable-content, aeo.content-extractability, tech.content-not-thin, tech.single-h1 or tech.heading-hierarchy. Uses the aeo-visibility MCP server if connected; works without it.
---

# Answer-first content

An answer engine can only quote what it can find and cut out cleanly. Pages that open each section
with the direct answer, then explain, are easier to quote than pages that circle the point for four
paragraphs. This skill covers how to restructure a page that way, and how to leave alone the pages
that do not need it.

## When this matters, and when it doesn't

It matters for pages that exist to answer a question: guides, comparisons, pricing explainers,
documentation, help articles, "what is X" pages.

It mostly does not matter for:

- **Homepages, product landing pages, contact and legal pages.** They are not answers. Do not
  force question headings onto them to turn a check green.
- **Narrative or opinion writing.** An essay's value is the argument. Chopping it into Q&A
  destroys it. Add a short summary at the top if you want something quotable.
- **Pages that are already well structured but get no citations.** Then the cause is probably
  elsewhere: the page may not be fetchable (see `aeo-server-rendering`, `aeo-ai-crawler-access`),
  or nothing off-site points to it. Do not rewrite a good page on a hunch.

Be honest about what is known. Google's own guidance on AI features says there are no extra
requirements or special optimizations to appear in AI Overviews or AI Mode beyond normal SEO
fundamentals, and that no special schema is needed. There is no verified public recipe for how any
other engine picks a passage, so do not promise that a given rewrite will earn a citation. What you
can say is that clear, complete, well-structured text is easier to extract, and it is also better
for human readers.

## Detect

Rule IDs this skill owns, with what the audit actually checks (from `@advance-labs/scoring` and
`@advance-labs/html-parser`):

| Rule | Passes when | Read it carefully |
|---|---|---|
| `aeo.question-headings` | At least one heading across **all audited pages** is question-like: it ends in `?`, or its first word is who, what, when, where, why, how, which, can, should, is, are, do, does or will | One heading anywhere is enough. "How to ..." and "Who we are" both count. A pass proves little. |
| `aeo.answerable-content` | Mean visible word count across pages is 300 or more **and** at least one `<ul>` or `<ol>` exists somewhere | Site-wide mean, not per page. |
| `aeo.content-extractability` | Mean `<p>` count per page is 3 or more **and** at least one list or table exists somewhere | Same caveat. |
| `aeo.speakable-structured-answers` | Any page has Speakable, HowTo or QAPage schema, a "how to" or "step-by-step" heading, or FAQ/QA schema | A "how to" heading alone passes it. Low weight; do not chase it. |
| `tech.content-not-thin` | Every page has 200 or more visible words | Word count is the whole `<body>` text minus script, style and `<head>`, so nav and footer text counts. A page with a long footer can pass while being thin. |
| `eeat.exp.content-depth` | Mean words across pages is 600 or more | A mean. Fix the pages that need depth, not every page. |
| `tech.headings-present` | Every page has at least one heading | |
| `tech.single-h1` | Every page has exactly one `<h1>` | |
| `tech.heading-hierarchy` | No heading jumps down more than one level (h2 to h4 fails; h3 back up to h2 is fine) | The first heading on the page may be any level. |

**With the MCP server.** Call `analyze_website_aeo` with the site URL. It crawls up to 10 pages and
returns `topFixes` (at most 8) with rule IDs. It only lists failed rules in the aeo, structured-data,
content and metadata categories, and it does not return per-page URLs. So you will see which rule
failed but not which page. Use the fallback below to find the pages.

**Without it.** Fetch the page and read the outline:

```bash
curl -sL https://example.com/guide | grep -oiE '<h[1-6][^>]*>.*?</h[1-6]>' | sed -E 's/<[^>]+>//g'
```

Look at the heading list the way a reader would. Then read the first paragraph under each heading.

To decide *which* pages deserve this work, use `discover_ranking_prompts` (needs a Perplexity key
passed to the tool). It returns the prompts people plausibly ask about a topic. Match each prompt
to the page that should answer it. A prompt with no page is a content gap, not a formatting problem.

## Decide

Work page by page. For each candidate page, answer these in order:

| Question | If no | If yes |
|---|---|---|
| Does the page answer a real question someone types or asks? | Leave it. | Continue. |
| Does it already open each section with its point? | Leave it. | Continue. |
| Is the answer buried (a long preamble, a story first, the number in paragraph five)? | Leave it. | Restructure. |
| Is the page genuinely too short to answer the question? | Restructure only. | Add real content, see below. |

**Question headings: use them where the heading really is the question.** "How much does X cost?"
is a good heading for a pricing section, because that is what readers ask. "Our Approach" does not
need to become "What is our approach?". Rewriting every heading as a question reads as spam and
adds nothing. A reasonable target is question headings on the sections that answer a discrete
question, and descriptive headings everywhere else.

**Thin versus deliberately short.** A 120-word contact page is not a problem. A 150-word "guide" is.
Google states it has no preferred word count and warns against writing to one. Treat the 200 and
300 and 600 word thresholds as the audit's heuristics, not as targets. Never pad. If a page is
thin, ask what the reader still needs to know, and answer that.

## Implement

Stack-agnostic shape of the change. See `references/examples.md` for before and after rewrites.

1. **One `<h1>`, then a clean outline.** The h1 is the page's topic. Sections are h2, their
   subsections h3. Do not pick a heading level for its font size; fix the size in CSS. Layout
   components that render a second h1 (a site-name logo, a hero banner, a card title) are the usual
   cause of `tech.single-h1`. Change the element, not the look.
2. **Lead each section with the answer.** First one or two sentences (roughly the first 40 to 60
   words) state the direct answer: the number, the yes or no, the definition. Then give the
   reasoning, caveats and examples. This helps human skimmers as much as any engine. The 40 to 60
   word figure is a writing guideline, not a measured threshold from any engine.
3. **Make the answer self-contained.** A passage lifted out of context should still make sense.
   Name the subject instead of "it" or "this", and include the unit and the scope ("in Ontario",
   "as of 2026").
4. **Use a list or table when the content is a list or a comparison.** Steps are an ordered list.
   Options with attributes are a table. Do not turn flowing reasoning into bullets.
5. **Keep the author's voice.** Edit structure, not style. Move the answer sentence up, split a
   long paragraph, add a heading. Do not rewrite their prose into a template. If the voice is
   distinctive, show the proposed change as a diff and let them accept it.
6. **Keep the content in the HTML the server sends.** If the page is rendered client-side, none of
   this is visible to crawlers that do not run JavaScript. Check `aeo-server-rendering` first.

Do not add FAQ markup in this skill; that belongs to `aeo-faq-qa-schema`. Do not mark up content
that is not visible on the page.

## Verify

1. Re-run `analyze_website_aeo` (or re-read the outline with the curl command) and confirm the
   owned rules that failed now pass. Remember the audit caps at 10 pages and several rules are
   site-wide, so a pass may come from other pages.
2. Check outline validity yourself: one h1, no level skipped on the way down.
3. For each rewritten section, read only its first two sentences. Do they answer the heading?
4. Optionally run `check_ai_visibility` for a target prompt before and after. Treat the result as
   one noisy sample. Engines vary by run and over time, and a single check is not proof either
   way. See `aeo-visibility-tracking` for how to measure properly.

## Pitfalls

- **Turning every heading into a question.** Over-optimization that hurts readers.
- **Padding to reach 300 or 600 words.** The thresholds are heuristics. Padding makes the page
  worse and gets no credit from Google, which says it has no preferred word count.
- **Treating a green audit as the goal.** `aeo.question-headings` passes with one question heading
  on the whole site. A pass says nothing about whether any page is quotable.
- **Hiding the answer in an accordion or tab that loads on click.** Content that is not in the
  initial HTML may not be read.
- **Fixing `tech.content-not-thin` by adding boilerplate.** The check counts nav and footer text,
  so the number can move without the page improving. Judge the main content.
- **A second h1 from a component library** (logo, hero, modal). Look at rendered HTML, not source.
- **Rewriting without asking.** If the page's purpose is unclear, ask what question it should
  answer before changing it.

## Sources

- Google Search Central, Creating helpful, reliable, people-first content (no preferred word count; do not change dates to seem fresh): https://developers.google.com/search/docs/fundamentals/creating-helpful-content, verified 2026-11-13
- Google Search Central, AI features and your website (no additional requirements or special optimization for AI Overviews and AI Mode; no special schema needed): https://developers.google.com/search/docs/appearance/ai-features, verified 2026-11-13
- Scoring rule source: `packages/scoring/src/aeo-rules.ts`, `technical-seo-rules.ts`, `eeat-rules.ts`; heading and word-count logic in `packages/html-parser/src/content.ts` and `headings.ts`, read 2026-11-13
