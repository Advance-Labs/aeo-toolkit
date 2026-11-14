# Shopify

Verified 2026-11-13: Shopify's Liquid `structured_data` filter converts a `product` or
`article` object to schema.org JSON. A product with no variants becomes a `Product`; with one or
more variants it becomes a `ProductGroup`. Output includes `brand`, `name`, `image`,
`description`, and `offers` with `price`, `priceCurrency`, `availability`, `url`.
Source: https://shopify.dev/docs/api/liquid/filters/structured_data

```liquid
<script type="application/ld+json">
  {{ product | structured_data }}
</script>
```

Not verified: whether your theme already emits this (many do, but check the rendered page), and
which Shopify fields map to GTIN and brand. Inspect the output for one product and compare it to
the product's admin fields before relying on it.

Steps:
1. View source on a product page, search `ld+json`, count Product or ProductGroup nodes.
2. If a theme and an app (reviews, SEO) both output one, disable one. Reviews apps often add
   `aggregateRating`; confirm those ratings are real and visible on the page.
3. If missing, add the snippet above to the product template (`main-product` section or
   `product.liquid`, depending on theme).
4. Add GTIN and brand data in the product admin, then check they appear in the output. If
   they do not, extend the JSON-LD in Liquid, and keep values from the product fields, not
   hard-coded.
