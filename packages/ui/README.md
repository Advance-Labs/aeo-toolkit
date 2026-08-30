# @advance-labs/ui

Shared React design-system components for the AEO Toolkit web apps (`llm-audit`,
`eeat-scanner`, `llms-txt-generator`, `ga-gsc-chat`). Every component is
**presentational**: it accepts typed data via props (from `@advance-labs/types`), renders
semantic HTML with Tailwind class strings, and contains no application logic.
There is no Tailwind build in this package — consumers provide it.

## Usage

```tsx
import { ScoreGauge, CategoryBreakdown, FixList, UrlInputForm } from '@advance-labs/ui';
import type { AuditReport } from '@advance-labs/types';

export function AuditView({ report }: { report: AuditReport }) {
  return (
    <>
      <UrlInputForm onSubmit={(url) => console.log('analyze', url)} />
      <ScoreGauge score={report.score} />
      <CategoryBreakdown categories={report.score.categories} />
      <FixList findings={report.topFixes} />
    </>
  );
}
```

Interactive components (`UrlInputForm`, `TemplateDownload`) carry the `'use client'`
directive and work in Next.js App Router server components when imported into a
client boundary.

## Public API

| Export | Props | Purpose |
|--------|-------|---------|
| `ScoreGauge` | `{ score: Score; size?; strokeWidth?; className? }` | Circular SVG score ring with the numeric 0–100 score and letter grade. |
| `CategoryBreakdown` | `{ categories: ScoreCategory[]; className? }` | Per-category score bars with pass/fail counts. |
| `FixList` | `{ findings: Finding[]; failedOnly?; limit?; className? }` | Prioritized fix list, sorted critical → info then by weight. |
| `UrlInputForm` | `{ onSubmit: (url: string) => void; loading?; placeholder?; submitLabel?; defaultValue?; className? }` | Controlled URL entry; normalizes the scheme and validates before calling `onSubmit`. |
| `GradeBadge` | `{ grade: ScoreGrade; size?; className? }` | Compact A–F grade pill. |
| `ReportLayout` | `{ title; children; subtitle?; actions?; className? }` | Semantic page shell (`<header>` + `<main>`) for report screens. |
| `TemplateDownload` | `{ template: GeneratedTemplate; onDownload?; className? }` | Renders a generated file with a download action; download side effect is injectable. |
| `LogoMark` | `{ size?; title?; idSuffix? }` | The square brand tile (gradient + "A" peak + cyan sparkle) as accessible inline SVG. Pass distinct `idSuffix` values to render multiple marks on one page. |
| `Logo` | `{ size?; variant?; className? }` | Horizontal lockup (mark + "AEO Toolkit" wordmark); `variant="dark"` uses light text. |

All prop types are also exported (`ScoreGaugeProps`, `FixListProps`, …).

## Status

**Implemented.** All nine components are real, presentational implementations with
co-located Vitest + Testing Library (jsdom) tests. No stubs.

- The `TemplateDownload` browser download (Blob + object URL) is isolated behind an
  injectable `onDownload` prop so it is unit-testable without a real download; the
  default DOM implementation is a guarded no-op in non-DOM environments.
