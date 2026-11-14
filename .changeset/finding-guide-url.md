---
'@advance-labs/scoring': minor
'@advance-labs/types': minor
---

Findings now carry `guideUrl`: the rule's fix guide on docs.advancelabs.dev, which links to the agent skill that owns the rule. `docsUrl` still points at the primary source. Also exports `ruleGuideUrl(id)` for consumers that build their own findings, such as E-E-A-T signals.
