# Before and after: answer-first rewrites

Each example changes structure only. The author's facts and tone stay. Invented numbers below are
placeholders; never ship an example figure as a real claim.

## 1. Buried answer

Before:

```html
<h2>Pricing</h2>
<p>When we started the studio we wanted a model that felt fair to small teams. Over several years
we tried hourly billing, retainers and fixed scopes. Each had trade-offs. Today most projects are
quoted as a fixed scope, and the figure depends on the pages and integrations involved.</p>
<p>A typical brochure site lands between [LOW] and [HIGH].</p>
```

After:

```html
<h2>How much does a website cost?</h2>
<p>A typical brochure site costs between [LOW] and [HIGH], quoted as a fixed scope. The figure
depends on the number of pages and the integrations involved.</p>
<p>When we started the studio we wanted a model that felt fair to small teams. We tried hourly
billing and retainers before settling on fixed scopes, because ...</p>
```

What changed: the heading is the real reader question, the number moved to the first sentence, the
backstory stayed, just later.

## 2. Comparison written as prose

Before: three paragraphs each describing a plan.

After: one sentence answer ("Pro suits most teams; Basic is for solo use."), then a table.

```html
<table>
  <thead><tr><th>Plan</th><th>Seats</th><th>Best for</th></tr></thead>
  <tbody>
    <tr><td>Basic</td><td>1</td><td>Solo use</td></tr>
    <tr><td>Pro</td><td>Up to 10</td><td>Small teams</td></tr>
  </tbody>
</table>
```

Use a table only when the content really has rows and columns.

## 3. Heading that should stay as it is

`<h2>Our approach</h2>` followed by a description of the firm's method. Leave it. It is not a
question a reader asks, and "What is our approach?" is filler. Question headings belong where the
section answers a discrete question.

## 4. Second h1 from a component

Symptom: `tech.single-h1` fails on every page. The cause is often a layout that renders the logo
or hero title as `<h1>` while each page also has its own.

Fix: change the layout element to a `<div>` or `<p>` and keep the visual style with a class. Keep
exactly one h1 per page, the page topic.

## 5. Skipped heading level

Before: `h1`, `h2`, `h4` (the h4 chosen because it looked right).

After: change the `h4` to `h3` and restyle with CSS. Going back up (h3 then h2) is always fine.

## 6. A thin page

A 140-word "guide to X". Do not pad. Ask what a reader still needs: the steps, the edge case, the
cost, the common mistake. Write those. If there is nothing more to say, the page may be better
merged into a stronger page than kept thin (check with `seo-cannibalization` before merging).
