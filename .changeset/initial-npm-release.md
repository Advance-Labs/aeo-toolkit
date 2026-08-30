---
'@advance-labs/types': minor
'@advance-labs/net-guard': minor
'@advance-labs/crawler': minor
'@advance-labs/html-parser': minor
'@advance-labs/scoring': minor
'@advance-labs/schema-validator': minor
---

First npm release. These six packages move from workspace-internal to published under the
`@advance-labs` scope, so they can be installed without cloning the monorepo.

Scope note: the packages were previously named `@aeo/*`. That scope was unavailable on npm,
so everything moved to `@advance-labs`. Nothing had been published under the old name, so no
existing installs break.
