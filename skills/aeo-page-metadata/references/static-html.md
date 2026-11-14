# Page metadata in plain HTML or other static sites

Every page needs its own head. If the site is hand-written HTML, copy the block below into each
page and edit the page-specific lines. If it is generated (Eleventy, Hugo, Jekyll, Hexo and so on),
put the block in the base layout and feed it from front matter. Where the generator supports it,
make title and description required so a page cannot ship without them.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page-specific title, 30 to 60 characters is a good target</title>
  <meta name="description" content="One accurate summary of this page. 70 to 160 characters is a good target.">
  <link rel="canonical" href="https://example.com/this-page">

  <meta property="og:title" content="Page-specific title">
  <meta property="og:description" content="Same summary as above">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://example.com/this-page">
  <meta property="og:image" content="https://example.com/images/this-page-og.png">
  <meta property="og:image:alt" content="What the image shows">

  <meta name="twitter:card" content="summary_large_image">
</head>
```

Notes:

- Charset should appear early in the head, before any content that contains non-ASCII text.
- `og:image` and `og:url` should be absolute URLs.
- Every `<img>` needs an `alt` attribute. `alt=""` means decorative. Omitting the attribute counts
  as missing in the audit.
- With many hand-written pages, check duplicates with a one-liner over the built files:

```bash
grep -rhoE '<title>[^<]*' --include=*.html . | sort | uniq -d
```

- If a template copies one page's head into all pages, the duplicate-title and duplicate-description
  problems follow immediately. Search for the template.
