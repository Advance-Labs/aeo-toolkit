# FAQ markup in Next.js (App Router)

Keep the Q&A as data, render it visibly, and derive the JSON-LD from the same array.

```tsx
import { JsonLd } from '@/components/json-ld'; // native <script>, escapes "<"; see aeo-organization-entity/references/nextjs.md

const faqs = [
  { q: 'Can I cancel at any time?', a: 'Yes. Cancel from the billing page.' },
  { q: 'Do you offer refunds?', a: 'Within 14 days of the first payment.' },
];

export default function Pricing() {
  return (
    <>
      <section>
        <h2>Frequently asked questions</h2>
        {faqs.map(f => (
          <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
        ))}
      </section>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a } })) }} />
    </>
  );
}
```

Keep this in a server component so both the `<details>` content and the script are in the
served HTML. If answers contain JSX, render plain text or simple HTML for `text`; do not
JSON.stringify a React element. Do not fetch answers client-side after a click.
