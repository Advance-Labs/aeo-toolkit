---
"@advance-labs/scoring": patch
---

`tech.canonical-present` no longer asks `noindex` pages for a canonical (its own text says "every indexable page"). `tech.canonical-resolves` and `tech.indexable` still see noindex pages. Found auditing aeo.advancelabs.dev, where `/login` (noindex, nofollow) failed the rule.
