---
"@advance-labs/scoring": minor
"@advance-labs/types": minor
---

Stop scoring pages that opt out of indexing. Pages marked `noindex` (meta robots or `X-Robots-Tag`) are left out of per-page rule scoring (titles, descriptions, thin content, headings, Open Graph, structured data, ...) and listed in the new `AuditReport.excludedPages` (`reason: 'noindex'`); they still count in `pagesCrawled`. Rules that inspect indexability opt back in with the new `Rule.includesNoindexPages`: `tech.indexable` (now ignores a noindex page the sitemap deliberately leaves out, still flags the homepage, any listed noindex page, and every noindex page when there is no sitemap), `tech.canonical-present` and `tech.canonical-resolves`. If every page is noindex nothing is excluded.
