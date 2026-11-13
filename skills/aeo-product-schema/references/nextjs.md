# Next.js

Verified 2026-11-13 (https://nextjs.org/docs/app/guides/json-ld): render JSON-LD as a native
`<script type="application/ld+json">` in `layout.js` or `page.js`, not with `next/script`. Escape
`<` because `JSON.stringify` does not sanitise for XSS. Types can come from the community package
`schema-dts`.

```tsx
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getProduct((await params).slug); // same data the page renders
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.images,
    description: product.description,
    sku: product.sku,
    brand: { '@type': 'Brand', name: product.brand },
    offers: {
      '@type': 'Offer',
      url: product.url,
      price: product.price.toFixed(2),
      priceCurrency: product.currency,
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      {/* visible product UI using the same `product` */}
    </>
  );
}
```

Build it from the same object that renders the visible price. If the page is cached or
statically generated, make sure revalidation covers price and stock, or markup goes stale.
Verify the markup is in the server-rendered HTML (`curl`), not injected client-side.
