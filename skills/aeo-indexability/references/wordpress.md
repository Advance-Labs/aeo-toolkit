# WordPress 6.x

**Sitemap:** core serves `/wp-sitemap.xml`. An SEO plugin (Yoast, Rank Math, AIOSEO) disables it
and serves its own (`/sitemap_index.xml` for Yoast). Reference whichever is live in robots.txt,
and do not run two. Core can be turned off with the `wp_sitemaps_enabled` filter, which
returns a 404 for the core sitemap.

**Accidental noindex.** Check, in this order:

1. Settings, Reading, "Discourage search engines from indexing this site". If ticked, WordPress
   adds a noindex robots meta tag to every page. Staging-to-live copies often keep it.
2. The SEO plugin's per-post "Allow search engines to show this page" / robots setting, and its
   site-wide defaults for post types and taxonomies.
3. A security or caching plugin adding `X-Robots-Tag`.

To set a robots directive in code, use the `wp_robots` filter:

```php
add_filter( 'wp_robots', function ( $robots ) {
    if ( is_page( 'thank-you' ) ) {
        $robots['noindex'] = true;
        $robots['follow']  = true;
    }
    return $robots;
} );
```

**Canonical:** core and the SEO plugins output it. Problems come from plugin conflicts (two
canonicals on one page) and from `home`/`siteurl` set to HTTP or the wrong host.
**Redirects:** use the SEO plugin's redirect manager or a redirect plugin; keep it to one hop.
When changing permalink structure, redirect old paths to new ones in the same step.
**HTTPS:** set both WordPress Address and Site Address to `https://`, then force the redirect at
the host or in `.htaccess`.
