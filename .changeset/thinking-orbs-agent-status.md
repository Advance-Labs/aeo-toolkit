---
'@advance-labs/ui': minor
---

`UrlInputForm`'s busy-button spinner is now the `thinking-orbs` agent-status indicator (`state="searching"`, 20px) instead of a plain CSS spinner, so it reads as "an agent is out fetching this" rather than generic loading chrome. `thinking-orbs@^0.3.1` is added as a runtime dependency (MIT, zero deps, `react>=18` peer — matches this package's existing `react` peer range).
