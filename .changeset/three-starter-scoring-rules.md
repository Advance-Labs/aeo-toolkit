---
'@advance-labs/types': minor
'@advance-labs/html-parser': minor
'@advance-labs/scoring': minor
---

Three new scoring rules (54 → 57): `tech.charset-declared` (#10), `aeo.content-freshness` (#11), and `tech.hreflang-valid` (#12). To support hreflang validation, `ParsedHtml` gains an optional `hreflangs` field and the parser a new `extractHreflangs` helper — both additive, no breaking changes.
