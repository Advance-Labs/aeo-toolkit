---
"@advance-labs/crawler": patch
---

Treat `https://example.com` and `https://example.com/` as one page. The requested root and its sitemap entry were queued under two keys, so the homepage was fetched twice and a site could fail `tech.unique-titles` against itself. Frontier URLs now go through an exported `canonicalUrl` (empty path becomes `/`, fragment stripped, query kept, non-root trailing slashes untouched).
