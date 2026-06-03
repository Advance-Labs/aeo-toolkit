import type { JSX } from 'react';
import type { Finding } from '@aeo/types';
import { cx, severityClasses, severityRank } from './utils.js';

export interface FixListProps {
  findings: Finding[];
  /**
   * When true (default), only failed findings are shown — the prioritized
   * "things to fix" list. Set false to render every finding.
   */
  failedOnly?: boolean;
  /** Cap the number of rows rendered. */
  limit?: number;
  /** Extra Tailwind classes appended to the list wrapper. */
  className?: string;
}

/**
 * Prioritized fix list: failed findings sorted by severity (critical → info)
 * then by descending weight, each rendered with a severity pill, title,
 * description, and recommendation. Presentational only.
 */
export function FixList({
  findings,
  failedOnly = true,
  limit,
  className,
}: FixListProps): JSX.Element {
  const filtered = failedOnly ? findings.filter((f) => !f.passed) : findings;
  const sorted = [...filtered].sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return b.weight - a.weight;
  });
  const visible = typeof limit === 'number' ? sorted.slice(0, limit) : sorted;

  if (visible.length === 0) {
    return (
      <p className={cx('text-sm text-emerald-700', className)} role="status">
        No issues found — everything passed.
      </p>
    );
  }

  return (
    <ol className={cx('flex flex-col gap-3', className)} aria-label="Prioritized fixes">
      {visible.map((finding) => (
        <li key={finding.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">{finding.title}</h3>
            <span
              className={cx(
                'shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide',
                severityClasses(finding.severity),
              )}
            >
              {finding.severity}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{finding.description}</p>
          <p className="mt-2 text-sm text-slate-800">
            <span className="font-medium">Fix: </span>
            {finding.recommendation}
          </p>
          {finding.affectedUrls && finding.affectedUrls.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Affects {finding.affectedUrls.length} URL
              {finding.affectedUrls.length === 1 ? '' : 's'}
            </p>
          ) : null}
          {finding.docsUrl ? (
            <a
              href={finding.docsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-block text-xs font-medium text-sky-700 underline"
            >
              Learn more
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
