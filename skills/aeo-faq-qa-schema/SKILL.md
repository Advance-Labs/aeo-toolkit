---
name: aeo-faq-qa-schema
description: Decide whether and how to add FAQPage, QAPage or HowTo structured data, and keep any Q&A markup identical to the questions and answers visible on the page. Use when someone asks to add FAQ schema, FAQPage JSON-LD, Q&A markup, HowTo schema, "FAQ rich results", or fixes an "FAQ or QA schema missing" or "FAQ/HowTo/Review schema" audit finding, or asks whether FAQ schema still works in Google. Covers aeo.faq-qa-schema and eeat.exp.faq-howto-review-schema. Uses the aeo-visibility MCP server if connected; works without it.
---

# FAQ, Q&A and HowTo markup: what it is still for

Be straight about this before writing any markup: **Google no longer shows FAQ rich results,
and removed HowTo rich results in 2023.** Adding FAQPage markup will not get anyone expandable
answers in Google Search. What is left is a machine-readable restatement of Q&A that is already
on the page. Whether any given answer engine reads it is not documented by the engines, so
treat it as low-cost hygiene, not a ranking tactic.

## When this matters / when it doesn't

**State of play, from Google Search Central (verified 2026-11-13):**

- FAQ rich result: restricted to well-known government and health sites in September 2023;
  deprecated with a notice on 2026-05-08 ("no longer appear in Google Search starting
  May 7, 2026"); documentation removed 2026-06-15.
- HowTo rich result: documentation removed 2023-09-14 because it is no longer shown on desktop
  or mobile. (This date comes from Google's updates log summary, not a page I could read
  verbatim.)
- QAPage: **still documented**, still eligible for a rich result, but for a narrow case: a page
  about one question where users can submit answers (a forum or community Q&A thread). Google
  lists a site-written FAQ and a how-to guide as invalid uses.

**It matters when** the page really does carry visible questions and answers, and you want the
same content available as structured data for engines and tools that parse it. Real FAQs on
pricing, onboarding or product pages are the usual case.

**It does not matter, or is wrong, when:**

- There is no visible Q&A. Do not add a FAQ block to a page just to hang schema on it. Content
  must exist for readers first. Google's guidelines are explicit: do not mark up content that
  is not visible, and the markup must be a true representation of the page.
- The "FAQ" is promotional copy dressed as questions, or the same FAQ is pasted on every page.
- The page is a blog post or essay. Use Article markup instead (`aeo-article-author-schema`).

**The audit does not require the markup.** `aeo.faq-qa-schema` passes if either FAQPage/QAPage
structured data is detected **or** the crawler detects an FAQ section in the visible HTML
(`content.hasFaq`). A page with a clearly marked up visible FAQ and no schema can already pass.
Do not treat a failing rule as a reason to write schema before checking for the visible content.

## Detect

| Rule | Passes when |
|---|---|
| `aeo.faq-qa-schema` | Any page has `FAQPage` or `QAPage` structured data (any nesting depth, any encoding), or any page has a detected visible FAQ section. |
| `eeat.exp.faq-howto-review-schema` | Any of: FAQPage/QAPage present; `HowTo` or `Review` present; a page has a detected visible FAQ or how-to section. |

The toolkit validator, if the markup exists:

- `FAQPage`: `mainEntity` must be present and contain `Question` items each with an
  `acceptedAnswer`. No valid question makes the item invalid; a mix produces a warning.
- `QAPage`: `mainEntity` must be a `Question` with an `acceptedAnswer` or `suggestedAnswer`.
- `HowTo`: `step` must be present.
- `Review`: `reviewRating` required.

Those are the toolkit's own checks. Google's QAPage documentation requires more (for example
`answerCount` and `Answer.text`), so a QAPage can pass the toolkit and still fail Google.

With the MCP server: `analyze_website_aeo` on the page, read the two rule results and the
structured-data detail. Without it: view-source and search for `FAQPage` and for an
`<h2>`/`<details>`/accordion Q&A section.

## Decide

| What the page is | Markup |
|---|---|
| Site-written list of questions with answers, visible on the page | `FAQPage` (optional hygiene) |
| One question, several user-submitted answers, with a form to add answers | `QAPage` |
| Numbered steps to accomplish a task | Skip `HowTo` for Google; mark nothing, or keep real `HowTo` only if the user wants it for non-Google consumers. Make the steps clear in HTML (`<ol>`). |
| Product reviews by real users | `Review`/`AggregateRating` inside `Product`; never self-reviews |
| Blog post | Not FAQ. `BlogPosting`. |
| Page has no Q&A | Nothing. Say the rule does not apply. |
| User wants "FAQ rich results" | Tell them they are gone, and why. Offer the hygiene option, not a promise. |

If a visible FAQ already passes the rule and the user asks for schema anyway, add it, but
do not tell them it will move rankings.

## Implement

Shape, independent of stack:

1. Render the questions and answers in the HTML first, in a real structure (headings or
   `<details>`), so engines and readers see them. Server-render them; see `aeo-server-rendering`.
2. Generate the JSON-LD **from the same data** that renders the visible Q&A, so the two cannot
   diverge. Hand-maintained duplicate copies will drift.
3. One `FAQPage` per page, `mainEntity` an array of `Question`; each `name` is the question text
   exactly as shown, each `acceptedAnswer` an `Answer` whose `text` is the answer as shown.
4. Keep `Answer.text` equivalent to what is displayed (plain text is safest; Google's removed FAQ
   docs used to allow a limited set of HTML tags, which can no longer be re-checked). Do not put
   content in the markup that is not on the page.
5. Mark up every question shown or none. Do not mark up only the flattering ones.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://example.com/pricing#faq",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Can I cancel at any time?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. You can cancel from the billing page and keep access until the end of the period."
      }
    },
    {
      "@type": "Question",
      "name": "Do you offer refunds?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Refunds are available within 14 days of the first payment."
      }
    }
  ]
}
```

`QAPage` for a real community thread (only if users can submit answers). Required by Google:
`mainEntity` Question with `name`, `answerCount`, and at least one `acceptedAnswer` or
`suggestedAnswer`, each with full `Answer.text`. Recommended: `author`, `datePublished`,
`upvoteCount`, answer `url`. One QAPage and one Question per page; comments go in `comment`,
not in `Answer`.

```json
{
  "@context": "https://schema.org",
  "@type": "QAPage",
  "mainEntity": {
    "@type": "Question",
    "name": "How do I rotate an API key without downtime?",
    "text": "Our key rotation invalidates the old key immediately. Can I overlap them?",
    "answerCount": 2,
    "upvoteCount": 14,
    "datePublished": "2026-10-02T10:00:00-04:00",
    "author": { "@type": "Person", "name": "Sam Ortiz" },
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Create the new key first, deploy it, then revoke the old one.",
      "upvoteCount": 11,
      "url": "https://example.com/q/rotate-api-key#answer-1"
    },
    "suggestedAnswer": [{
      "@type": "Answer",
      "text": "Use two keys and rotate one at a time.",
      "upvoteCount": 3,
      "url": "https://example.com/q/rotate-api-key#answer-2"
    }]
  }
}
```

Content generated by AI: Google's QAPage docs have an optional `digitalSourceType` for
this; if the answers are machine-generated, say so rather than omitting it.

Stack recipes: `references/nextjs.md`, `references/astro.md`, `references/wordpress.md`,
`references/static-html.md`.

## Verify

1. Re-run `analyze_website_aeo` (or the validator) on the page; the two rules should pass.
2. Diff the markup against the page: every `Question.name` and `Answer.text` in the JSON
   appears in the visible content, same wording, and nothing in the JSON is missing from the
   page.
3. Schema Markup Validator and Rich Results Test: no syntax errors. Do not expect a FAQ
   rich result preview; if the Rich Results Test no longer lists FAQ, that is consistent
   with the deprecation. I could not confirm how Search Console and the Rich Results Test now
   treat the FAQ type.
4. Check that content in collapsed accordions is in the served HTML, not fetched on click.

## Pitfalls

- **FAQ markup on every page** (site-wide widget). It describes content the page does not
  have.
- **Answers truncated or rewritten in the markup** to be "snippet friendly". It must match.
- **FAQ built from a click-to-load accordion** whose answers load by API; neither crawlers nor
  the audit's HTML detection will see it.
- **`QAPage` on a static FAQ.** Wrong type; Google lists it as invalid.
- **`HowTo` kept for a Google feature that no longer exists.** Harmless, pointless.
- **Duplicate FAQ blocks** from a plugin and the theme. See `aeo-structured-data-validation`.
- **Promising rich results to a client.** Say what changed and when.
- **Hidden FAQ text** (display: none) used to feed markup. That is the thing the guidelines
  forbid.

## Sources

- Google, Search Central updates log (FAQ deprecation 2026-05-08, docs removal 2026-06-15; Sept 2023 FAQ/HowTo changes): https://developers.google.com/search/updates (verified 2026-11-13; the 2023 entries could only be read as a summary, not verbatim; the FAQ and HowTo documentation pages now return the updates log)
- Google, Q&A page structured data: https://developers.google.com/search/docs/appearance/structured-data/qapage (verified 2026-11-13)
- Google, general structured data guidelines: https://developers.google.com/search/docs/appearance/structured-data/sd-policies (verified 2026-11-13)
- schema.org FAQPage, QAPage, Question, HowTo: https://schema.org/FAQPage , https://schema.org/QAPage , https://schema.org/Question , https://schema.org/HowTo (verified 2026-11-13)
- Toolkit logic: `packages/scoring/src/aeo-rules.ts`, `eeat-rules.ts`, `packages/schema-validator/src/validation.ts`
