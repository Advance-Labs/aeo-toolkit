# @advance-labs/html-parser

## 0.3.0

### Minor Changes

- b700d8e: Detect client-side rendering and stop misdiagnosing it as thin content.

  `ContentSignals` gains `scriptCount` and `hasEmptyAppShell`, and a new AEO rule
  (`aeo.content-server-rendered`) fails pages that serve an empty app shell.

  Previously a JavaScript-rendered page failed `tech.content-not-thin`, so the report told the
  owner to write more content when the actual problem was that their content never reaches a
  crawler. Same symptom, opposite fix. The new rule separates them and says so explicitly in
  its detail text.

  Detection was hardened after adversarial review found three defects: a false positive on
  short server-rendered pages carrying an unrelated empty mount div, a false negative on the
  most common client-rendered page of all (a shell holding `Loading...`), and missed mount
  points for Gatsby, Nuxt, Quasar and Svelte. All three are covered by regression tests.

  **Semver note.** `scriptCount` and `hasEmptyAppShell` are REQUIRED fields, so any code that
  constructs a `ContentSignals` breaks at compile time. On a 1.x package that would be a major
  bump. These are 0.x, where the convention allows breaking changes in a minor, and they were
  first published less than a day ago, so `minor` is the deliberate choice rather than an
  oversight. Code that only reads `ContentSignals` is unaffected.

  They are required rather than optional on purpose: an optional field would default to
  "never client-rendered" at every construction site that forgot it, which is silently the
  wrong answer for the exact case this rule exists to catch.

- da9de33: Three new scoring rules (54 → 57): `tech.charset-declared` (#10), `aeo.content-freshness` (#11), and `tech.hreflang-valid` (#12). To support hreflang validation, `ParsedHtml` gains an optional `hreflangs` field and the parser a new `extractHreflangs` helper — both additive, no breaking changes.

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

## 0.1.0

Initial release.
