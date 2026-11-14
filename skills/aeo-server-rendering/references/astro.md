# Astro 5

Astro renders to HTML by default (`output: 'static'`), so content is in the HTML unless you put
it in a client island or fetch it in the browser.

**Find the problems**

- Real content inside a component with `client:only="react"` (or vue/svelte). `client:only`
  skips server rendering entirely. Use `client:load` / `client:visible` / `client:idle` instead,
  which render HTML on the server and hydrate later.
- `fetch()` inside a `<script>` tag or a framework component's `useEffect`. Move it to the
  frontmatter, which runs at build time (static) or request time (SSR):

```astro
---
// src/pages/pricing.astro
const res = await fetch('https://api.example.com/plans')
const plans = await res.json()
---
<ul>{plans.map((p) => <li>{p.name}: {p.price}</li>)}</ul>
```

**SSR pages in a static site.** In Astro 5, pages are prerendered by default; opt a page into
request-time rendering with `export const prerender = false` (requires an adapter). Either mode
sends HTML. Only `client:only` and browser-side fetching leave it empty.

**Tabs/accordions.** Render every panel, hide with CSS or use native `<details>`:

```astro
<details><summary>Shipping</summary><p>Orders ship within 2 days.</p></details>
```

**Verify** with `astro build`, then grep the output: `grep -l "your headline" dist/pricing/index.html`.
That file is exactly what a non-JS crawler is served.
