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

`hasEmptyAppShell` is a required field, so any code constructing `ContentSignals` must
supply it.
