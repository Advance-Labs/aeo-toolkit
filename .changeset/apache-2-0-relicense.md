---
'@advance-labs/types': patch
'@advance-labs/crawler': patch
'@advance-labs/scoring': patch
'@advance-labs/html-parser': patch
'@advance-labs/net-guard': patch
'@advance-labs/schema-validator': patch
---

Republish under Apache-2.0, and add discovery keywords.

The repo relicensed from MIT to Apache-2.0 in `7f9cb3e`, but that commit carried no
changeset, so it never triggered a release. Every published 0.2.0 tarball still ships
`"license": "MIT"` and a full MIT `LICENSE` file, while the repo, website, `llms.txt` and
`SECURITY.md` all say Apache-2.0. A developer reading the repo and then installing the
package receives different terms than the ones advertised.

This changeset exists to move that correction onto the registry. No source code changes.

`patch` is deliberate: the code is identical, and on 0.x a `^0.2.0` range accepts 0.2.x but
NOT 0.3.0 — so a patch reaches existing consumers automatically, where a minor would strand
them on the MIT build. npm cannot retroactively amend 0.2.0; anyone already on it keeps MIT
until they upgrade.

Also adds a `keywords` array to each package. All six previously had none, so they were
undiscoverable via `npm search` and carried no topic chips on npmjs.com.
