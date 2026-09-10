# @advance-labs/net-guard

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
