---
'@advance-labs/types': patch
'@advance-labs/crawler': patch
'@advance-labs/scoring': patch
'@advance-labs/html-parser': patch
'@advance-labs/net-guard': patch
'@advance-labs/schema-validator': patch
---

Add an `author` field and point `homepage` at the documentation site.

Every package published with `author: null` and a `homepage` aimed at the GitHub
readme, so nothing on npmjs.com named a human or linked back to advancelabs.dev.
`author` is now `Lucas Krawczak <lucas@advancelabs.dev> (https://advancelabs.dev/lucas)`
and `homepage` is `https://docs.advancelabs.dev/aeo-toolkit` — a developer landing
from npm gets the docs rather than a repo readme.

This also makes the npm profile a corroborating identity source. The site treats
`sameAs` as an entity-CONFIRMATION signal, only worth asserting once the target
corroborates the claim; with no author field, npm confirmed nothing. After this
ships, the package pages name the author and link the domain, and the relationship
is two-way.

No source changes.
