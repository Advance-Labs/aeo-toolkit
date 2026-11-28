# @advance-labs/net-guard

## 0.3.0

### Minor Changes

- 60bbfd8: Security: close a DNS-rebinding SSRF bypass in `createLiveSafeFetchDeps` (CWE-918, CWE-367).

  The live deps validated one DNS answer, then let `fetch` connect by hostname and resolve again, so a
  TTL-0 record could answer "public" to the guard and "127.0.0.1" to the connection. Requests now go
  through `node:http(s)` with `guardedLookup`, which validates inside the connection's own lookup, so
  the socket can only open to an address that passed the check. A blocked connect-time answer returns
  `blockedReason: 'private-address'`.

  New exports: `guardedLookup` (reuse it in a custom `fetchImpl`) and `GUARD_BLOCKED`.

  Reported by Vishal Suwalka (vishalsuwalkaj@gmail.com).

## 0.2.7

### Patch Changes

- Updated dependencies [8d1598b]
  - @advance-labs/types@0.6.0

## 0.2.6

### Patch Changes

- Updated dependencies [31f8cd0]
  - @advance-labs/types@0.5.0

## 0.2.5

### Patch Changes

- Updated dependencies [333a915]
  - @advance-labs/types@0.4.0

## 0.2.4

### Patch Changes

- d6e9f7d: README: add an install line and the Apache-2.0 licence line.
- Updated dependencies [d6e9f7d]
  - @advance-labs/types@0.3.1

## 0.2.3

### Patch Changes

- Updated dependencies [b700d8e]
- Updated dependencies [da9de33]
  - @advance-labs/types@0.3.0

## 0.2.2

### Patch Changes

- f62532a: Add an `author` field and point `homepage` at the documentation site.

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

- Updated dependencies [f62532a]
  - @advance-labs/types@0.2.2

## 0.2.1

### Patch Changes

- f0890cc: Republish under Apache-2.0, and add discovery keywords.

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

- Updated dependencies [f0890cc]
  - @advance-labs/types@0.2.1

## 0.2.0

### Minor Changes

- cc35cb4: First npm release. These six packages move from workspace-internal to published under the
  `@advance-labs` scope, so they can be installed without cloning the monorepo.

  Scope note: the packages were previously named `@aeo/*`. That scope was unavailable on npm,
  so everything moved to `@advance-labs`. Nothing had been published under the old name, so no
  existing installs break.

### Patch Changes

- Updated dependencies [cc35cb4]
  - @advance-labs/types@0.2.0
