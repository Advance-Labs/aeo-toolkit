# Plain HTML, WordPress and other hosts

**Plain HTML / any build tool.** Write `llms.txt` at the web root, or better, generate it in the
build step from the same page list as `sitemap.xml`. A 20-line script that walks your content
folder and writes `dist/llms.txt` is enough.

**Header.** Add `X-Robots-Tag: noindex` for `/llms.txt` at the host:

```nginx
location = /llms.txt { add_header X-Robots-Tag "noindex"; }
```

```apache
<Files "llms.txt">
  Header set X-Robots-Tag "noindex"
</Files>
```

Netlify / Cloudflare Pages: `_headers` file, see `astro.md`. Vercel: `vercel.json` headers.

**WordPress.** A physical `llms.txt` in the web root is served as-is; add the header at the
server as above. To generate dynamically, serve it from a rewrite and emit the header in PHP:

```php
add_action( 'template_redirect', function () {
    if ( untrailingslashit( parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ) ) !== '/llms.txt' ) {
        return;
    }
    status_header( 200 );
    header( 'Content-Type: text/plain; charset=utf-8' );
    header( 'X-Robots-Tag: noindex' );
    echo "# " . get_bloginfo( 'name' ) . "\n\n> " . get_bloginfo( 'description' ) . "\n\n## Pages\n";
    foreach ( get_pages() as $p ) {
        echo '- [' . $p->post_title . '](' . get_permalink( $p ) . ")\n";
    }
    exit;
} );
```

A physical file is simpler and more predictable than the dynamic route. Some SEO plugins may
generate this file themselves (not verified here); if one does, use it and add the header.
