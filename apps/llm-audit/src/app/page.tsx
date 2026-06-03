'use client';

import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import type { AuditReport } from '@aeo/types';
import { CategoryBreakdown, FixList, ScoreGauge, TemplateDownload, UrlInputForm } from '@aeo/ui';
import { AuditApiError, downloadBlob, requestAudit, requestReportPdf } from '../lib/client.js';

type Status = 'idle' | 'auditing' | 'done' | 'error';

export default function HomePage(): JSX.Element {
  const [status, setStatus] = useState<Status>('idle');
  const [report, setReport] = useState<AuditReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const runAudit = useCallback(async (url: string): Promise<void> => {
    setStatus('auditing');
    setErrorMessage(null);
    setReport(null);
    setPdfError(null);
    try {
      const result = await requestAudit(url);
      setReport(result);
      setStatus('done');
    } catch (err) {
      const message =
        err instanceof AuditApiError
          ? err.message
          : 'Something went wrong while running the audit.';
      setErrorMessage(message);
      setStatus('error');
    }
  }, []);

  const downloadPdf = useCallback(async (): Promise<void> => {
    if (report === null) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      const blob = await requestReportPdf(report);
      const host = safeHost(report.url);
      downloadBlob(blob, `aeo-audit-${host}.pdf`);
    } catch (err) {
      setPdfError(
        err instanceof AuditApiError ? err.message : 'Could not generate the PDF report.',
      );
    } finally {
      setPdfBusy(false);
    }
  }, [report]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          LLM &amp; Technical SEO Audit
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Crawl up to 50 pages, score technical SEO and answer-engine optimization out of 100, and
          get a prioritized fix list plus ready-to-use templates for any missing files.
        </p>
      </header>

      <section aria-label="Audit input">
        <UrlInputForm
          onSubmit={(url) => {
            void runAudit(url);
          }}
          loading={status === 'auditing'}
          submitLabel="Run audit"
        />
      </section>

      {status === 'error' && errorMessage !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      ) : null}

      {status === 'auditing' ? (
        <div
          className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
          aria-live="polite"
        >
          Crawling and scoring the site. This can take a moment for larger sites…
        </div>
      ) : null}

      {status === 'done' && report !== null ? (
        <AuditResults
          report={report}
          onDownloadPdf={() => {
            void downloadPdf();
          }}
          pdfBusy={pdfBusy}
          pdfError={pdfError}
        />
      ) : null}
    </main>
  );
}

function AuditResults({
  report,
  onDownloadPdf,
  pdfBusy,
  pdfError,
}: {
  report: AuditReport;
  onDownloadPdf: () => void;
  pdfBusy: boolean;
  pdfError: string | null;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-6">
          <ScoreGauge score={report.score} />
          <div className="flex flex-col gap-1">
            <p className="text-sm text-slate-500">
              Audited <span className="font-medium text-slate-700">{report.url}</span>
            </p>
            <p className="text-sm text-slate-500">
              {report.pagesCrawled} page{report.pagesCrawled === 1 ? '' : 's'} crawled ·{' '}
              {report.score.criticalCount} critical issue
              {report.score.criticalCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={pdfBusy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pdfBusy ? 'Preparing PDF…' : 'Download PDF'}
          </button>
          {pdfError !== null ? (
            <p role="alert" className="text-xs text-red-600">
              {pdfError}
            </p>
          ) : null}
        </div>
      </section>

      <section aria-label="Category breakdown" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Category breakdown</h2>
        <CategoryBreakdown categories={report.score.categories} />
      </section>

      <section aria-label="Prioritized fixes" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Prioritized fixes</h2>
        <FixList findings={report.topFixes} />
      </section>

      {report.templates.length > 0 ? (
        <section aria-label="Generated templates" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Generated templates</h2>
          <p className="text-sm text-slate-600">
            Starter files for crawl hints the site is missing. Download and drop them into your site
            root.
          </p>
          <div className="flex flex-col gap-4">
            {report.templates.map((template) => (
              <TemplateDownload key={template.filename} template={template} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** Best-effort hostname for the download filename; falls back to "site". */
function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, '-') || 'site';
  } catch {
    return 'site';
  }
}
