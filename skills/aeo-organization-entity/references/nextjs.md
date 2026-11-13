# Organization entity in Next.js (App Router)

Render JSON-LD as a native `<script type="application/ld+json">` in a server component, not
through `next/script` and not through the `metadata` export (which has no JSON-LD field). Next.js's
own guide recommends this, and says to escape `<` because `JSON.stringify` does not sanitise
strings (verified 2026-11-13, https://nextjs.org/docs/app/guides/json-ld).

## One source of truth

```ts
// lib/entity.ts
export const SITE = 'https://example.com';
export const ORG_ID = `${SITE}/#organization`;

export const organization = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: 'Example Corporation',
  url: `${SITE}/`,
  logo: { '@type': 'ImageObject', '@id': `${SITE}/#logo`, url: `${SITE}/logo-512.png`, width: 512, height: 512 },
  sameAs: ['https://www.linkedin.com/company/example', 'https://github.com/example'],
} as const;
```

```tsx
// components/json-ld.tsx
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
```

```tsx
// app/page.tsx  (homepage only carries the full node)
import { JsonLd } from '@/components/json-ld';
import { organization, SITE, ORG_ID } from '@/lib/entity';

export default function Home() {
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@graph': [
        organization,
        { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: organization.name,
          publisher: { '@id': ORG_ID } },
      ] }} />
      {/* page */}
    </>
  );
}
```

## Pitfalls specific to Next.js

- Putting the full node in `app/layout.tsx` repeats it on every page. That is allowed, and it is
  fine if the content is identical, but there is no benefit over homepage-only. If you do, make
  sure it is the same constant, never built from `headers()` or the request URL.
- Do not build `url` or `@id` from `window.location` or the request host; preview deployments
  then publish `*.vercel.app` identities. Use an env var for the canonical origin.
- Multiple apps or subdomains in one monorepo: import the same `entity.ts` from a shared package.
- Confirm the script is in the server HTML (`curl -s URL | grep ld+json`); a client-only
  component that injects it after hydration is visible to Google but not to crawlers that do not
  run JavaScript.
