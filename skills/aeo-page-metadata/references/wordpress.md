# Page metadata in WordPress

WordPress core supplies the document basics; titles, descriptions and social tags normally come
from an SEO plugin. Plugin screens and field labels change between versions, so confirm what you
see in the admin rather than trusting names here.

## Document basics (theme)

- Title: the theme must declare `add_theme_support( 'title-tag' )` so WordPress (and the SEO plugin)
  controls the `<title>`. A theme that hard-codes `<title>` in `header.php` overrides the plugin and
  is a common cause of duplicate or odd titles. Look for it first.
- `lang`: `<html <?php language_attributes(); ?>>` in `header.php`.
- Charset: `<meta charset="<?php bloginfo( 'charset' ); ?>">`.
- Viewport: `<meta name="viewport" content="width=device-width, initial-scale=1">`. Most modern
  themes include it; old or custom ones may not.
- All of the above is theme territory. If the site uses a child theme, edit the child, not the
  parent, or updates will erase the change.

## Titles and descriptions (SEO plugin)

Yoast SEO, Rank Math, All in One SEO and The SEO Framework all expose a title and description per
post or page, and a site-wide template for the rest (archives, taxonomy pages). The audit failures
come from three places:

1. **Templates** with no description fallback. Fix the site-wide defaults.
2. **Posts and pages left at the plugin default.** Edit them individually, starting with the pages
   `gsc_ctr_gaps` and `gsc_search_analytics` show are seen but not clicked.
3. **Archive and tag pages** all sharing one title pattern. Set a distinct pattern, or set them to
   noindex if they have no value (check with the user first; do not noindex by reflex).

Social: the same plugins have social settings for a default image and per-post overrides, and emit
`og:*` and `twitter:*` tags. Turn on the Twitter/X card output and set a default image so no page is
missing `og:image`.

If two SEO plugins are active they may both output tags, producing duplicates. Keep one.

## Alt text

In the Media Library the field is "Alternative Text"; in the block editor an image block has an alt
text field in the sidebar. Bulk-fixing a library: filter attachments with empty alt, fix real
images by hand, and for decorative images leave the alt empty but ensure the theme outputs an
`alt=""` attribute (some themes omit the attribute entirely, which counts as missing).

## Verify

`curl -sL` the page and read the `<head>`. Caching plugins can serve stale HTML; purge the cache
after changes before concluding the edit failed.
