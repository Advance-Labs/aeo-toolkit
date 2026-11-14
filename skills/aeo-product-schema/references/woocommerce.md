# WooCommerce

Verified 2026-11-13 from the WooCommerce code reference
(https://woocommerce.github.io/code-reference/classes/WC-Structured-Data.html): `WC_Structured_Data`
generates Product data (`generate_product_data`, hooked to `woocommerce_single_product_summary`)
and outputs it in the footer. Default types include product, review, breadcrumblist, website and
order. It validates GTINs (8, 12, 13 or 14 digits), and on variable products it uses the selected
variation only when the request identifies exactly one purchasable variation; otherwise it falls
back to the parent product's `AggregateOffer`.

Not verified: the exact filter names for customising the output. Search the plugin source for
`apply_filters` in `class-wc-structured-data.php` rather than trusting a remembered name. Also not
verified: how Yoast, Rank Math or other SEO plugins interact; test it.

Steps:
1. Check the rendered product page for duplicate Product nodes (WooCommerce plus an SEO plugin).
   Keep one source.
2. Confirm price and stock status in the JSON-LD match the page, including on sale and
   out-of-stock products.
3. Fill the GTIN/identifier field if your WooCommerce version has one; otherwise add it through
   a documented extension point. Never fill with made-up values.
4. If a reviews plugin adds ratings, confirm they come from real customers and show on the page.
