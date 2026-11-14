# WordPress 6.x

WordPress serves a **virtual** `/robots.txt` unless a physical `robots.txt` exists in the web
root. A physical file wins and ignores everything below.

Add rules through the `robots_txt` filter (parameters: `$output`, `$public`):

```php
// in a small mu-plugin or the theme's functions.php
add_filter( 'robots_txt', function ( $output, $public ) {
    if ( ! $public ) {
        return $output; // site set to "discourage search engines": leave it alone
    }
    $output .= "\nUser-agent: OAI-SearchBot\nAllow: /\n";
    $output .= "User-agent: Claude-SearchBot\nAllow: /\n";
    $output .= "User-agent: PerplexityBot\nAllow: /\n";
    // Training opt-out. Remove if the owner is happy to be trained on.
    foreach ( array( 'GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended' ) as $bot ) {
        $output .= "\nUser-agent: {$bot}\nDisallow: /\n";
    }
    return $output;
}, 20, 2 );
```

- Settings, Reading, "Discourage search engines from indexing this site" makes WordPress emit
  `Disallow: /` for everyone. This is the most common reason a WordPress site is invisible.
  It is often left on after a staging copy goes live.
- Yoast, Rank Math and AIOSEO each edit robots.txt from their own screen. Look there first;
  two plugins writing it produces a file nobody chose.
- Security plugins and host firewalls (Wordfence, Sucuri, host-level bot protection) can block
  AI user agents before WordPress runs. Check their logs, not robots.txt.
- Core generates a sitemap at `/wp-sitemap.xml`; SEO plugins replace it with their own.
  Reference whichever one is live.
