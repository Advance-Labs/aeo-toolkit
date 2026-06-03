# @aeo/scoring

The keystone scorer of the AEO Toolkit: a declarative, weighted rule engine plus three rule
sets (technical SEO, AEO, E-E-A-T) and the report builders that four downstream tools render.
It is pure TypeScript with no runtime dependencies beyond `@aeo/types` — all crawl, parse, and
schema data arrives via an injected `ScoringContext`, so every function is unit-testable without
any network or filesystem access.

## Usage

```ts
import {
  auditScore,
  buildAuditReport,
  eeatScore,
  scoreToGrade,
  technicalSeoRules,
  aeoRules,
  runRules,
  generateTemplates,
} from '@aeo/scoring';
import type { ScoringContext } from '@aeo/types';

// `ctx` is assembled by @aeo/crawler + @aeo/html-parser + @aeo/schema-validator.
declare const ctx: ScoringContext;

const score = await auditScore(ctx); // combined technical + AEO Score
const report = await buildAuditReport(ctx, { durationMs: 4200, version: '0.1.0' });
const eeat = eeatScore(ctx); // four-pillar E-E-A-T report
const templates = generateTemplates(ctx); // starter files for anything missing

// Run a custom rule set directly:
const { categories, score: custom } = await runRules(ctx, [...technicalSeoRules, ...aeoRules]);
```

## How scoring works

- Each `Rule.evaluate(ctx)` returns `{ passed }` (sync or async). A throwing rule is treated as a
  non-fatal failure so one bad rule can never crash an audit.
- **Category score** = weighted pass-ratio × 100 (`Σ passed-weight / Σ weight`). A category with no
  weighted rules scores 100.
- **Overall score** = weighted mean across categories, rounded; grade via `scoreToGrade`
  (≥90 A, ≥80 B, ≥70 C, ≥60 D, else F).
- **`topFixes`** = failed findings sorted by severity (`critical → info`), then descending weight.
- **Single-page mode** (`ctx.mode === 'single-page'`): rules that need multi-page crawl data (e.g.
  title uniqueness) pass/skip gracefully instead of penalizing the page.

## Public API

| Export | Kind | Purpose |
|--------|------|---------|
| `runRules(ctx, rules)` | async fn | Evaluate rules → `{ categories, score }` |
| `aggregateScore(categories)` | fn | Combine categories into an overall `Score` |
| `scoreToGrade(n)` | fn | 0–100 → `ScoreGrade` letter |
| `clampScore(n)` | fn | Clamp arbitrary number into 0–100 |
| `technicalSeoRules` | `Rule[]` | 24 technical-SEO + on-page rules across 8 categories |
| `aeoRules` | `Rule[]` | 10 answer-engine-optimization heuristics |
| `eeatScore(ctx)` | fn | Four-pillar `EeatReport` (Experience/Expertise/Authoritativeness/Trust) |
| `eeatSignalDefs` | array | Inspectable E-E-A-T signal metadata (no detect fns) |
| `auditScore(ctx)` | async fn | `runRules` with technical + AEO rules → `Score` |
| `auditRules` | `Rule[]` | The combined technical + AEO rule set |
| `buildAuditReport(ctx, opts)` | async fn | Full `AuditReport`: score, topFixes, templates, meta |
| `prioritizeFixes(findings)` | fn | Sort failed findings by severity then weight |
| `generateTemplates(ctx)` | fn | Starter `robots.txt` / `llms.txt` / `sitemap.xml` for missing files |
| `KEY_AI_BOTS` | array | The AI user-agents whose access matters most |

All domain shapes (`Score`, `Finding`, `ScoreCategory`, `ScoringContext`, `AuditReport`,
`EeatReport`, `GeneratedTemplate`, …) come from `@aeo/types` — never redefined here.

## Status

Implemented. Pure, deterministic, dependency-free scoring logic with full Vitest coverage
(happy path + edge cases for every export, including empty and single-page contexts). No stubs —
this package requires no live third-party credentials.
