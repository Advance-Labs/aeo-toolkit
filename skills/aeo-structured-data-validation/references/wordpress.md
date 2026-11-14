# Structured data validation in WordPress

WordPress is the stack where duplicate, conflicting markup is most common.

## Find every emitter
View-source the live page (not the editor) and list each `application/ld+json` block. Typical
sources:

- **Yoast SEO**: one `<script type="application/ld+json" class="yoast-schema-graph">` containing
  a connected `@graph` (Organization/Person, WebSite, WebPage, Article, BreadcrumbList).
- **Rank Math**: its own graph block.
- **Theme**: many themes add Article, Organization, or BreadcrumbList.
- **Schema, review, FAQ and recipe plugins** and page builders: each adds its own.
- **WooCommerce**: emits Product markup, and your SEO plugin may add its own too.

If two sources emit the same type with different data, that is the defect. Two plugins each
producing a complete graph is the classic cause of `aeo.entity-identity-consistent` failing.

## Fix
- Keep the SEO plugin as the single graph emitter, and turn off the theme's and other
  plugins' schema options (most have a toggle). Deactivating a plugin and checking view-source
  is the quickest test of who emits what.
- Extend rather than replace: add missing properties with the plugin's filters (Yoast:
  `wpseo_schema_*`; Rank Math: `rank_math/json_ld`). Replace only when the plugin cannot produce
  the right shape, and then disable its output for that type.
- Caching and optimisation plugins can serve a stale page with old markup; purge after fixing.
- Fields left blank in the editor often produce empty strings in the markup; fill them or
  remove the node.
- Multisite: check each site separately.

## Verify
Use the validator script from the main skill against saved HTML from the live URL, then the Rich
Results Test and Schema Markup Validator on the same URL.
