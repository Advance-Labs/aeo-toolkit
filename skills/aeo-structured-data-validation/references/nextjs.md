# Structured data validation in Next.js

- Emit JSON-LD as a native `<script type="application/ld+json">` in a server component, with
  `JSON.stringify(data).replace(/</g, '\\u003c')` (Next.js JSON-LD guide, verified 2026-11-13).
  Building the string yourself is how invalid JSON gets in.
- Validate the output, not the component: `curl -s http://localhost:3000/path` against a
  production build (`next build && next start`), since dev rendering can differ.
- Common duplicates: a root `layout.tsx` that emits an Organization plus a page that emits its
  own with a different `@id`, or a third-party SEO package (`next-seo`) running alongside hand
  written blocks. Pick one.
- Do not read the origin from the request; use one env-configured canonical origin, or preview
  deployments publish their own `@id`s.
- TypeScript: types from `schema-dts` catch wrong property names at compile time.
- ISR and cached pages: confirm the cached HTML has the markup, and that updated data
  regenerates it.
