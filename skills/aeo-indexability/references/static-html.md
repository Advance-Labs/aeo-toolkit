# Plain HTML and any host

**Sitemap:** a `sitemap.xml` at the root. Generate it in the build; a hand-edited file goes
stale.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/pricing</loc><lastmod>2026-10-02</lastmod></url>
</urlset>
```

`lastmod` is the date the page's content last meaningfully changed, not today's date. Only list
canonical, indexable, 200 URLs.

**Canonical:** in every page's `<head>`: `<link rel="canonical" href="https://example.com/pricing">`.
Absolute `https://` URL. Relative values fail `tech.canonical-resolves`.

**noindex:** `<meta name="robots" content="noindex">` in the head, or the `X-Robots-Tag` header
for non-HTML files.

**Redirects (one hop, to the final URL):**

```
# Netlify / Cloudflare Pages: _redirects
/old-page  /new-page  301
```
```nginx
# nginx
location = /old-page { return 301 https://example.com/new-page; }
server { listen 80; server_name example.com www.example.com; return 301 https://example.com$request_uri; }
```
```apache
# .htaccess
Redirect 301 /old-page https://example.com/new-page
```

**IndexNow:** put a key file at the root (`https://example.com/<key>.txt` containing the key),
then `curl "https://api.indexnow.org/indexnow?url=https://example.com/new-page&key=<key>"`
after each deploy for changed URLs. Check the current format on indexnow.org before scripting a
batch POST.
