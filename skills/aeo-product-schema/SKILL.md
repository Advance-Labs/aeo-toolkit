---
name: aeo-product-schema
description: Add or repair Product, Offer and review structured data on e-commerce and DTC product pages so shoppers, Google merchant listings and AI answer engines can read price, availability, brand and identifiers. Use when someone asks about "product schema", "JSON-LD for my products", "price not showing in Google", "merchant listing", "GTIN", "star ratings on product pages", "ChatGPT recommending my product", or when schema price disagrees with the page. Works for Shopify, WooCommerce and Next.js. Uses the aeo-visibility MCP server (analyze_website_aeo, check_ai_visibility) if connected.
---

# Product schema for shops

Product markup states, in machine-readable form, what a page sells: name, image, price,
currency, availability, brand and identifiers. Search features read it, and it gives answer
engines a clean copy of facts that are otherwise scattered through a page.

**Note:** the scoring engine has no product rule yet. `analyze_website_aeo` will not fail a
product page for missing Product markup. Detection here uses its general structured-data
findings plus manual inspection (below). Do not tell the user their audit "passed" product
schema; there is nothing to pass.

## When this matters / when it doesn't

Matters when the site sells products directly, or lists specific products people compare.

Does not matter, or needs a different approach, when:
- Pages are categories, blog posts or "best of" lists. Google's product rich results "only
  support pages that focus on a single product (or multiple variants of the same product)".
- The business sells services. Use `aeo-local-business-schema` or Service markup instead.
- The shop already outputs correct Product JSON-LD. Check before adding a second copy.

Be honest about outcomes: markup makes a page eligible for product search features, it does not
guarantee them, and nothing here shows that markup makes an AI engine recommend a product. The
measurable proxy is whether engines cite the product page for shopper questions (Verify).

## Detect

1. Call `analyze_website_aeo` on a product URL and read its structured-data findings.
2. Inspect the page itself: `curl -s URL | grep -o '<script type="application/ld+json">.*'`
   or view source and search `ld+json`. Also run Google's Rich Results Test and
   validator.schema.org.
3. Look for these problems: no Product node; two Product nodes (theme plus an SEO plugin);
   price or availability that differs from the visible page; `offers` missing `priceCurrency`;
   ratings with no visible reviews on the page.
4. If the audit tooling you use has a product mode (the advance-labs audit scripts have
   `--product`), note it measures which answers name the brand and which retailers and review
   sites get cited, not markup validity. Use it to see where engines send shoppers.

## Decide

**Product snippet or merchant listing?** Google's split: product snippets are for pages
"where people can't directly purchase the product" (reviews, pros and cons); merchant listings
are "for pages where customers can purchase products from you". Adding the merchant-listing
required properties also makes the page eligible for snippets, and Google advises giving as much
product information as you have. For a shop, target merchant listings.

Properties (from Google's docs, 2026-11-13):

| Level | Required | Worth adding |
|---|---|---|
| Product, merchant listing | `name`, `image`, `offers` | `brand.name`, `description`, `sku`, `mpn`, global IDs (`gtin`, `gtin13` etc.), `color`, `size`, `material`, `aggregateRating`, `review` |
| Product snippet | `name` plus one of `review`, `aggregateRating`, `offers` | the rest as above |
| Offer | `price` (and `priceCurrency` alongside it) | `availability`, `itemCondition`, `url`, `shippingDetails`, `hasMerchantReturnPolicy`, `priceValidUntil` |

- `priceCurrency` is a three-letter ISO 4217 code. Give one `availability` value and one
  `itemCondition` value.
- Include the most specific GTIN you truly have, in numeric form (no URLs). If a product has
  none, omit the field. Do not invent identifiers.
- Shipping and return policy are better set once at Organization level (or in Merchant Center)
  than repeated per product.
- Sale pricing: the active price has no `priceType`; a struck-through original uses
  `priceType: https://schema.org/StrikethroughPrice`.

**Reviews.** The rules are strict, and breaking them risks losing rich results:
- Ratings "must be sourced directly from users"; do not hand-compile them.
- Reviews and ratings must be visible on the page. Do not aggregate ratings from other sites.
- Do not mark up fake or undisclosed incentivised reviews.
- **Self-serving reviews:** if the entity being reviewed controls the reviews about itself,
  pages using `LocalBusiness` or any other `Organization` type are ineligible for star review
  results. This covers a company writing reviews of itself, in markup or via an embedded
  third-party widget. A review of a *product* sold on the page is the normal product case; do
  not attach the same ratings to the Organization node or to a LocalBusiness node.
- If there are no real reviews, leave rating fields out. An empty promise is worse.

**Variants.** One page, several colours or sizes: use `ProductGroup` with `variesBy`,
`hasVariant` and `productGroupID`, and give each variant its own `sku` or GTIN, `url` and
`offers`. If variants are on separate URLs, each page repeats the group and lists the others
as `url`-only stubs.

## Implement

1. Generate the JSON-LD from the same data that renders the visible price and stock. A template
   or helper, not a hand-pasted blob. This is the single best protection against drift.
2. Emit one Product node per product page. If an SEO plugin also emits one, turn off one source.
3. Keep price, currency, availability and the visible page identical. Google's rule: markup must
   "be a true representation of the page content" and must not describe content users cannot see.
4. Make sure the page is crawlable and indexable (not blocked by robots.txt or `noindex`).
5. If you also run a Merchant Center feed, keep it consistent with the markup. Google says both
   together "maximize your eligibility" and a feed can supply pricing that is missing from markup.

Stack specifics: read `references/shopify.md` for Shopify, `references/woocommerce.md` for
WooCommerce, `references/nextjs.md` for a custom Next.js storefront.

## Verify

- Rich Results Test on 3 to 5 products, including one out of stock and one with variants.
  Zero errors, and read the warnings.
- Change a price in the admin, reload, and confirm both visible page and JSON-LD changed.
- Search Console: Enhancements, Merchant listings and Product snippets reports after Google
  recrawls (days to weeks; do not expect same-day).
- AI visibility, honestly framed: pick 5 shopper questions, run `check_ai_visibility` with each
  prompt and the product URL before the change, and again after engines have had time to
  re-fetch. That tool queries **Perplexity Sonar only** and needs a Perplexity key; one run is
  one sample. Repeat prompts, report citation rate, and do not claim causation from a single
  before/after.

## Pitfalls

- Duplicate Product nodes with conflicting prices.
- Price in markup is stale, or tax-inclusive on the page but exclusive in markup.
- `availability` always `InStock` regardless of inventory.
- Ratings copied from Amazon or a review site, or the same rating on every product.
- Putting `aggregateRating` on the Organization node (self-serving review problem).
- Adding a fake GTIN to satisfy a warning.
- Marking up a category page as if it were one product.
- Assuming the theme already did it. Check the rendered HTML.

## Sources

- Product structured data intro: https://developers.google.com/search/docs/appearance/structured-data/product (verified 2026-11-13)
- Product snippet: https://developers.google.com/search/docs/appearance/structured-data/product-snippet (verified 2026-11-13)
- Merchant listing: https://developers.google.com/search/docs/appearance/structured-data/merchant-listing (verified 2026-11-13)
- Product variants: https://developers.google.com/search/docs/appearance/structured-data/product-variants (verified 2026-11-13)
- Review snippet, including self-serving reviews: https://developers.google.com/search/docs/appearance/structured-data/review-snippet (verified 2026-11-13)
- General structured data guidelines: https://developers.google.com/search/docs/appearance/structured-data/sd-policies (verified 2026-11-13)
