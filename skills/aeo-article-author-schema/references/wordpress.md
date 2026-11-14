# Article and author schema in WordPress

## Yoast SEO / Rank Math
Both emit an `Article` (posts) node and a `Person` node for the post author by default, linked
by `@id`, with `datePublished` and `dateModified` taken from the post. So the usual work is
making the inputs good, not adding markup:

- Fill the author's profile (display name, bio, website/social URLs). Yoast's author `Person`
  `url` points to the author archive and `sameAs` is built from the user's profile URLs; check
  that the archive is not disabled or `noindex`, since many sites disable author archives and
  that leaves the `url` dead.
- Use real display names: the schema uses the display name, so "admin" becomes `"name": "admin"`.
- Set the post type's schema type (Article vs BlogPosting vs TechArticle) in the plugin's
  per-post-type or per-post settings rather than adding another block.
- Exactly one plugin should emit Article markup. Disable the theme's or a schema plugin's
  article output.

## Extend vs replace
Extend when the plugin's Article and Person are correct but missing a property (add `sameAs`,
`jobTitle`, `image`) via its filters (`wpseo_schema_article`, `wpseo_schema_person` for Yoast;
`rank_math/json_ld` for Rank Math), in a child theme or must-use plugin. Replace only when the
plugin cannot express the right author (multiple authors, guest authors from a co-authors
plugin); then turn off its article/person output and emit your own graph with the same `@id`
pattern.

## Pitfalls
- Guest-author and co-author plugins often show a byline that the SEO plugin does not know
  about; markup credits the WP user, the page shows someone else. They must match.
- Bumping `post_modified` through bulk edits or a cache-warming plugin changes `dateModified`.
- Page builders that print their own `Article` block cause duplicates; check view-source.
