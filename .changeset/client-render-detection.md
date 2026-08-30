---
'@advance-labs/types': minor
'@advance-labs/html-parser': minor
'@advance-labs/scoring': minor
---

Detect client-side rendering and stop misdiagnosing it as thin content.

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
