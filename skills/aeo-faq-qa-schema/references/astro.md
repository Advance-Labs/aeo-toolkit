# FAQ markup in Astro

```astro
---
const faqs = [
  { q: 'Can I cancel at any time?', a: 'Yes. Cancel from the billing page.' },
];
const ld = { '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
---
<section>
  <h2>Frequently asked questions</h2>
  {faqs.map(f => <details><summary>{f.q}</summary><p>{f.a}</p></details>)}
</section>
<script is:inline type="application/ld+json" set:html={JSON.stringify(ld).replace(/</g, '\\u003c')} />
```

Source the `faqs` array from frontmatter or a content collection so the page and the markup
share it. `<details>` content is in the static HTML, which is what you want.
