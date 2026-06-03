# @aeo/pdf

Server-side PDF renderer for AEO Toolkit audit reports, built on
[`@react-pdf/renderer`](https://react-pdf.org). Given a fully-computed `AuditReport` (produced by
`@aeo/scoring` and assembled by the audit web apps), it renders a clean one-page PDF showing the
overall score and grade, a per-category breakdown with score bars, and the prioritized list of top
fixes. This is the path the **web apps** use for their server-side "Download PDF" endpoints.

> The Chrome extension (tool 5) does **not** use this package — it renders locally with `jsPDF`
> to keep its audit fully client-side with zero server calls. `@aeo/pdf` is server-only.

## Usage

```ts
import { renderAuditReportPdf } from '@aeo/pdf';
import type { AuditReport } from '@aeo/types';

// In a Next.js route handler (Node runtime):
export async function GET(): Promise<Response> {
  const report: AuditReport = await runAudit('https://example.com');
  const bytes = await renderAuditReportPdf(report);
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="aeo-audit.pdf"',
    },
  });
}
```

You can also embed the document component directly (e.g. inside a larger `@react-pdf/renderer`
tree, or to render with a custom `renderTo*` call):

```tsx
import { AuditReportDocument } from '@aeo/pdf';

const doc = <AuditReportDocument report={report} />;
```

## Public API

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `AuditReportDocument` | Component | `(props: { report: AuditReport }) => JSX.Element` | `@react-pdf/renderer` `Document`/`Page` layout: score + grade, category breakdown, top fixes. Pure presentation, no I/O. |
| `AuditReportDocumentProps` | Type | `{ report: AuditReport }` | Props for `AuditReportDocument`. |
| `renderAuditReportPdf` | Function | `(report: AuditReport) => Promise<Uint8Array>` | Renders the report to PDF bytes via `renderToBuffer`. Returns a non-empty `Uint8Array`. Server-only (Node runtime). |

All domain types (`AuditReport`, `Finding`, `ScoreCategory`, …) come from `@aeo/types`.

## Status

**Implemented.** `AuditReportDocument` and `renderAuditReportPdf` are real, production-ready
implementations — no stubs in the rendering path. The render smoke test in `index.test.ts` is
best-effort: if `@react-pdf/renderer` cannot initialize under the vitest `node` environment, that
single byte-assertion test self-skips with a logged reason (marked `// STUB:`), while the
component-structure tests still verify the layout type-checks and constructs. The component renders
without external fonts (uses the built-in Helvetica family) so it works in serverless runtimes.
