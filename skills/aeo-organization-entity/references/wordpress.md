# Organization entity in WordPress

Most WordPress sites already emit an Organization or Person node from their SEO plugin. The
job is usually to fix and complete that node, not to add a second one.

## Yoast SEO
Settings, Site representation (Search appearance, General): choose Organization or Person,
set the name, upload a logo, and fill the social profile fields. Yoast outputs an
Organization node with a stable `@id` of the form `https://example.com/#organization` and
links `WebSite` and `WebPage` nodes to it. Extra profile URLs beyond the built-in fields can
be added in its "Other social profiles" area. To add properties it does not expose (for
example a Wikidata `sameAs`), extend its graph with the `wpseo_schema_organization` filter
instead of printing a second script block.

## Rank Math
Titles and Meta, Local SEO: set Person or Company, name, logo, URLs. Rank Math emits an
Organization node too; extend it with the `rank_math/json_ld` filter.

## Rules of thumb
- Exactly one active plugin should emit Organization. If a theme, a "schema" plugin or a
  page builder also emits one, disable its organization output; two nodes with different `@id`
  or `url` is what fails `aeo.entity-identity-consistent`.
- Extend rather than replace when the plugin's node is correct but incomplete. Replace only
  when the plugin cannot be configured to the right `name`/`url`/type; then disable its
  organization output and publish your own node, keeping the same `@id` pattern.
- The plugin's site name and logo settings feed the node. Fix them there; hand-editing theme
  files is overwritten on the next update.
- Multisite or several domains: set the same legal name and the apex `url` on each, and confirm
  each site does not mint its own `@id` from its own domain.
- Verify what is actually served (view-source, or the validator), because caching and
  optimisation plugins sometimes serve stale markup.

Filter sketch (put in a small must-use plugin or child theme, not the parent theme):

```php
add_filter('wpseo_schema_organization', function ($data) {
    $data['sameAs'][] = 'https://www.wikidata.org/wiki/Q0000000'; // only if the item is real
    return $data;
});
```
