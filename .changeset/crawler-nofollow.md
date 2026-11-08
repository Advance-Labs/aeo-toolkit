---
"@advance-labs/crawler": patch
---

Honour `nofollow`: links on a page whose robots meta or `X-Robots-Tag` says `nofollow` (or `none`) are not followed, and `<a rel="nofollow">` links are skipped. The page itself is still fetched and recorded. Exports `pageForbidsFollow`.
