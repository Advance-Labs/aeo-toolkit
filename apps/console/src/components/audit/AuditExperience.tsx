'use client';

import { useCallback, useId, useState } from 'react';
import type { FormEvent, JSX, ReactNode } from 'react';
import type {
  AuditReport,
  Finding,
  FindingSeverity,
  GeneratedTemplate,
  Score,
  ScoreCategory,
  ScoreGrade,
} from '@advance-labs/types';
import { Badge, Button, Input, Reveal, SpotlightCard } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  AuditApiError,
  downloadBlob,
  requestAudit,
  requestReportPdf,
} from '@/components/audit/client.js';

type Status = 'idle' | 'auditing' | 'done' | 'error';

/* -------------------------------------------------------------------------- */
/* Presentational helpers (dark-theme variants of the @advance-labs/ui scoring utils).  */
/* These mirror the package helpers but tint for the console's dark surface.   */
/* -------------------------------------------------------------------------- */

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function gradeForScore(score: number): ScoreGrade {
  const s = clamp(score, 0, 100);
  if (s >= 90) return 'A';
  if (s >= 80) return 'B';
  if (s >= 70) return 'C';
  if (s >= 60) return 'D';
  return 'F';
}

/** Hex stroke/fill color for a grade — tuned to glow on dark. */
function gradeColor(grade: ScoreGrade): string {
  switch (grade) {
    case 'A':
      return '#34d399';
    case 'B':
      return '#a3e635';
    case 'C':
      return '#fbbf24';
    case 'D':
      return '#fb923c';
    case 'F':
      return '#f87171';
  }
}

function gradeChipClasses(grade: ScoreGrade): string {
  switch (grade) {
    case 'A':
      return 'bg-emerald-500/12 text-emerald-300 border-emerald-400/30';
    case 'B':
      return 'bg-lime-500/12 text-lime-300 border-lime-400/30';
    case 'C':
      return 'bg-amber-500/12 text-amber-300 border-amber-400/30';
    case 'D':
      return 'bg-orange-500/12 text-orange-300 border-orange-400/30';
    case 'F':
      return 'bg-red-500/12 text-red-300 border-red-400/30';
  }
}

function severityChipClasses(severity: FindingSeverity): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/12 text-red-300 border-red-400/30';
    case 'high':
      return 'bg-orange-500/12 text-orange-300 border-orange-400/30';
    case 'medium':
      return 'bg-amber-500/12 text-amber-300 border-amber-400/30';
    case 'low':
      return 'bg-cyan-500/12 text-cyan-300 border-cyan-400/30';
    case 'info':
      return 'bg-white/5 text-slate-300 border-white/15';
  }
}

function severityRank(severity: FindingSeverity): number {
  switch (severity) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    case 'low':
      return 3;
    case 'info':
      return 4;
  }
}

/** Best-effort hostname for the download filename; falls back to "site". */
function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, '-') || 'site';
  } catch {
    return 'site';
  }
}

/** Strip the scheme for a tidy display label. */
function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/* -------------------------------------------------------------------------- */
/* Root experience — owns all state + the preserved API data flow.            */
/* -------------------------------------------------------------------------- */

/**
 * Interactive audit island. Renders the input row, the idle/loading/error/result
 * states, and wires the preserved API flow (`POST /api/audit/technical`, the PDF
 * export, and the score / fix-list / template rendering). Restyle only — the
 * request/response contract is unchanged from the original page component.
 */
export function AuditExperience(): JSX.Element {
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
    <div className="flex flex-col gap-6">
      <AuditInputCard
        loading={status === 'auditing'}
        onSubmit={(url) => {
          void runAudit(url);
        }}
      />

      {status === 'error' && errorMessage !== null ? <AuditError message={errorMessage} /> : null}

      {status === 'auditing' ? <AuditLoading /> : null}

      {status === 'idle' ? <AuditEmptyState /> : null}

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
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Input row — Input primitive + primary Button, with inline validation.       */
/* -------------------------------------------------------------------------- */

/** Prepend `https://` when the scheme is omitted so the API gets an absolute URL. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function AuditInputCard({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (url: string) => void;
}): JSX.Element {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalized = normalizeUrl(value);
    if (normalized === '') {
      setError('Please enter a URL.');
      return;
    }
    try {
      new URL(normalized);
    } catch {
      setError('That does not look like a valid URL.');
      return;
    }
    setError(null);
    onSubmit(normalized);
  }

  return (
    <div className="surface relative overflow-hidden p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-brand-violet/15 blur-3xl"
      />
      <form onSubmit={handleSubmit} className="relative flex flex-col gap-3" noValidate>
        <label htmlFor={inputId} className="text-sm font-medium text-slate-200">
          Website URL
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <GlobeIcon />
            </span>
            <Input
              id={inputId}
              name="url"
              type="text"
              inputMode="url"
              autoComplete="url"
              value={value}
              disabled={loading}
              placeholder="example.com"
              aria-invalid={error !== null}
              aria-describedby={error !== null ? errorId : undefined}
              onChange={(event) => setValue(event.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" size="lg" disabled={loading} className="sm:w-auto">
            {loading ? (
              <>
                <Spinner />
                Running audit…
              </>
            ) : (
              <>
                Run audit
                <ArrowIcon />
              </>
            )}
          </Button>
        </div>
        {error !== null ? (
          <p id={errorId} role="alert" className="text-sm text-red-300">
            {error}
          </p>
        ) : (
          <p className="text-xs text-slate-400">
            Crawls up to 50 pages. No sign-up, and we never store your site content — your report
            renders right here.
          </p>
        )}
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* States: error / loading / empty                                            */
/* -------------------------------------------------------------------------- */

function AuditError({ message }: { message: string }): JSX.Element {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200"
    >
      <span className="mt-0.5 shrink-0 text-red-300">
        <WarningIcon />
      </span>
      <span>{message}</span>
    </div>
  );
}

function AuditLoading(): JSX.Element {
  return (
    <div className="surface flex flex-col gap-5 p-6 sm:p-7" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3">
        <span className="text-brand-cyan">
          <Spinner />
        </span>
        <p className="text-sm font-medium text-slate-200">
          Crawling and scoring the site — this can take a moment for larger sites.
        </p>
      </div>
      {/* Skeleton shimmer rows hint at the layout that's about to appear. */}
      <div className="grid gap-4 sm:grid-cols-[auto,1fr]">
        <div className="h-28 w-28 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="flex flex-col justify-center gap-3">
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/[0.05]" />
          <div className="h-3 w-3/4 animate-pulse rounded-full bg-white/[0.04]" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="h-2.5 w-1/4 animate-pulse rounded-full bg-white/[0.05]" />
            <div className="h-2 w-full animate-pulse rounded-full bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditEmptyState(): JSX.Element {
  const previews: Array<{ label: string; icon: ReactNode }> = [
    { label: 'Overall score & letter grade', icon: <GaugeIcon /> },
    { label: 'Category-by-category breakdown', icon: <BarsIcon /> },
    { label: 'Prioritized, severity-ranked fixes', icon: <ListIcon /> },
    { label: 'Generated robots.txt / llms.txt / sitemap', icon: <FileIcon /> },
  ];
  return (
    <div className="surface flex flex-col gap-5 p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-brand-cyan"
        >
          <SparkIcon />
        </span>
        <div>
          <h2 className="text-base font-semibold text-white">What you&apos;ll get</h2>
          <p className="text-sm text-slate-400">
            Enter a URL above to generate a full report. A typical run returns:
          </p>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {previews.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
          >
            <span aria-hidden className="shrink-0 text-brand-cyan">
              {item.icon}
            </span>
            <span className="text-sm text-slate-300">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Results                                                                     */
/* -------------------------------------------------------------------------- */

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
    <div className="flex flex-col gap-6">
      <Reveal>
        <ScoreSummaryCard
          report={report}
          onDownloadPdf={onDownloadPdf}
          pdfBusy={pdfBusy}
          pdfError={pdfError}
        />
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-5">
        <Reveal className="lg:col-span-2" delay={0.05}>
          <ResultPanel
            title="Category breakdown"
            subtitle="Score per signal group."
            icon={<BarsIcon />}
            className="h-full"
          >
            <CategoryBars categories={report.score.categories} />
          </ResultPanel>
        </Reveal>

        <Reveal className="lg:col-span-3" delay={0.1}>
          <ResultPanel
            title="Prioritized fixes"
            subtitle="Highest-impact issues first."
            icon={<ListIcon />}
            className="h-full"
          >
            <FixCards findings={report.topFixes} />
          </ResultPanel>
        </Reveal>
      </div>

      {report.templates.length > 0 ? (
        <Reveal delay={0.15}>
          <ResultPanel
            title="Generated templates"
            subtitle="Starter files for crawl hints the site is missing — drop them into your site root."
            icon={<FileIcon />}
          >
            <div className="grid gap-4">
              {report.templates.map((template) => (
                <TemplateCard key={template.filename} template={template} />
              ))}
            </div>
          </ResultPanel>
        </Reveal>
      ) : null}
    </div>
  );
}

function ResultPanel({
  title,
  subtitle,
  icon,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <section className={cn('surface flex flex-col gap-5 p-6 sm:p-7', className)}>
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-brand-cyan"
        >
          {icon}
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function ScoreSummaryCard({
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
  const { score } = report;
  return (
    <SpotlightCard className="p-6 sm:p-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
          <ScoreRing score={score} />
          <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-base font-bold',
                  gradeChipClasses(score.grade),
                )}
              >
                {score.grade}
              </span>
              <Badge tone="cyan">Audit complete</Badge>
            </div>
            <p className="max-w-md text-sm text-slate-300">
              Audited <span className="font-medium text-white">{displayUrl(report.url)}</span> —{' '}
              {report.pagesCrawled} page{report.pagesCrawled === 1 ? '' : 's'} crawled.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Stat label="Passed" value={score.passedCount} tone="good" />
              <Stat label="Failed" value={score.failedCount} tone="warn" />
              {score.criticalCount > 0 ? (
                <Stat label="Critical" value={score.criticalCount} tone="bad" />
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 lg:items-end">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onDownloadPdf}
            disabled={pdfBusy}
          >
            {pdfBusy ? (
              <>
                <Spinner />
                Preparing PDF…
              </>
            ) : (
              <>
                <DownloadIcon />
                Download PDF
              </>
            )}
          </Button>
          {pdfError !== null ? (
            <p role="alert" className="text-xs text-red-300">
              {pdfError}
            </p>
          ) : null}
        </div>
      </div>
    </SpotlightCard>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'good' | 'warn' | 'bad';
}): JSX.Element {
  const toneClasses: Record<typeof tone, string> = {
    good: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300',
    warn: 'border-amber-400/25 bg-amber-500/10 text-amber-300',
    bad: 'border-red-400/25 bg-red-500/10 text-red-300',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
        toneClasses[tone],
      )}
    >
      <span className="tabular-nums font-semibold">{value}</span>
      {label}
    </span>
  );
}

/** Circular SVG progress ring around the numeric 0–100 score. */
function ScoreRing({ score }: { score: Score }): JSX.Element {
  const size = 168;
  const strokeWidth = 12;
  const overall = clamp(Math.round(score.overall), 0, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - overall / 100);
  const stroke = gradeColor(score.grade);
  const center = size / 2;

  return (
    <figure
      className="relative inline-flex shrink-0"
      role="img"
      aria-label={`Overall score ${overall} out of 100, grade ${score.grade}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)',
            filter: `drop-shadow(0 0 8px ${stroke}66)`,
          }}
        />
      </svg>
      <figcaption className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold tabular-nums text-white">{overall}</span>
        <span className="text-xs uppercase tracking-widest text-slate-400">/ 100</span>
      </figcaption>
    </figure>
  );
}

function CategoryBars({ categories }: { categories: ScoreCategory[] }): JSX.Element {
  if (categories.length === 0) {
    return <p className="text-sm text-slate-400">No category data available.</p>;
  }
  return (
    <ul className="flex flex-col gap-4" aria-label="Score breakdown by category">
      {categories.map((category) => {
        const pct = clamp(Math.round(category.score), 0, 100);
        const color = gradeColor(gradeForScore(category.score));
        const total = category.passedCount + category.failedCount;
        return (
          <li key={category.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-slate-200">{category.label}</span>
              <span className="text-sm tabular-nums text-slate-300">
                {pct}
                <span className="text-slate-400">
                  {' '}
                  · {category.passedCount}/{total}
                </span>
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${category.label} score`}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 10px ${color}55`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function FixCards({ findings }: { findings: Finding[] }): JSX.Element {
  const sorted = [...findings.filter((f) => !f.passed)].sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return b.weight - a.weight;
  });

  if (sorted.length === 0) {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
      >
        <CheckIcon />
        No issues found — everything passed.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3" aria-label="Prioritized fixes">
      {sorted.map((finding) => (
        <li
          key={finding.id}
          className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-white/15"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">{finding.title}</h3>
            <span
              className={cn(
                'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
                severityChipClasses(finding.severity),
              )}
            >
              {finding.severity}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{finding.description}</p>
          <p className="mt-2 text-sm text-slate-200">
            <span className="font-medium text-brand-cyan">Fix: </span>
            {finding.recommendation}
          </p>
          {finding.affectedUrls && finding.affectedUrls.length > 0 ? (
            <AffectedUrls urls={finding.affectedUrls} />
          ) : null}
          {finding.docsUrl ? (
            <a
              href={finding.docsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-cyan underline-offset-2 hover:underline"
            >
              Learn more
              <ExternalIcon />
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function TemplateCard({ template }: { template: GeneratedTemplate }): JSX.Element {
  const handleDownload = useCallback(() => {
    if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return;
    const blob = new Blob([template.content], { type: template.contentType });
    downloadBlob(blob, template.filename);
  }, [template]);

  return (
    <section
      className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
      aria-label={`Generated ${template.filename}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-mono text-sm font-semibold text-white">{template.filename}</h3>
          <p className="text-xs text-slate-400">{template.reason}</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={handleDownload}>
          <DownloadIcon />
          Download
        </Button>
      </div>
      <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-white/[0.06] bg-black/30 p-3 text-xs leading-relaxed text-slate-300">
        <code>{template.content}</code>
      </pre>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Inline SVG icons (no icon library).                                        */
/* -------------------------------------------------------------------------- */

function GlobeIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" />
    </svg>
  );
}

function ArrowIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function DownloadIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12M7 11l5 5 5-5M5 21h14" />
    </svg>
  );
}

function Spinner(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function WarningIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

/** Show this many URLs before collapsing the rest behind a disclosure. */
const URLS_SHOWN_INLINE = 3;

/**
 * The specific URLs a finding applies to.
 *
 * This used to render as a bare count ("Affects 21 URLs"), which names a problem without
 * locating it. Rules like `tech.sitemap-covers-pages` are only actionable once you can see
 * which pages are missing, so the URLs are listed: inline when there are few, behind a native
 * <details> when there are many so one finding cannot push the rest of the report off-screen.
 *
 * Makes no completeness claim — rules cap this list, and the finding's own description carries
 * the true total (e.g. "21 of 45 crawled pages").
 *
 * Mirrors `FixList` in @advance-labs/ui, which this component deliberately duplicates for its
 * dark-theme variant; keep the two in step.
 */
function AffectedUrls({ urls }: { urls: readonly string[] }): JSX.Element {
  const label = `${urls.length} affected URL${urls.length === 1 ? '' : 's'}`;
  const list = (
    <ul className="mt-1.5 flex flex-col gap-1">
      {urls.map((url) => (
        <li
          key={url}
          className="truncate font-mono text-[11px] leading-relaxed text-slate-400"
          title={url}
        >
          {url}
        </li>
      ))}
    </ul>
  );

  if (urls.length <= URLS_SHOWN_INLINE) {
    return (
      <div className="mt-2">
        <p className="text-xs font-medium text-slate-300">{label}</p>
        {list}
      </div>
    );
  }

  return (
    <details className="group/urls mt-2">
      <summary className="cursor-pointer list-none text-xs font-medium text-slate-300 underline-offset-2 hover:text-white hover:underline">
        {label}
        <span className="ml-1 text-slate-500 group-open/urls:hidden">(show)</span>
        <span className="ml-1 hidden text-slate-500 group-open/urls:inline">(hide)</span>
      </summary>
      {list}
    </details>
  );
}

function CheckIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ExternalIcon(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 4h6v6M20 4l-9 9M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

function GaugeIcon(): JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM13.4 10.6 19 5M21 12a9 9 0 1 0-18 0" />
    </svg>
  );
}

function BarsIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19V10M10 19V5M16 19v-7M22 19H2" />
    </svg>
  );
}

function ListIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function FileIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-5ZM9 13h6M9 17h6" />
    </svg>
  );
}

function SparkIcon(): JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
    </svg>
  );
}
