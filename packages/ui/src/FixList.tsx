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
      <p
        className={cx(
          'inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300',
          className,
        )}
        role="status"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        No issues found — everything passed.
      </p>
    );
  }

  return (
    <ol className={cx('flex flex-col gap-3', className)} aria-label="Prioritized fixes">
      {visible.map((finding) => (
        <li
          key={finding.id}
          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-sm backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.05]"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">{finding.title}</h3>
            <span
              className={cx(
                'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider backdrop-blur-sm',
                severityClasses(finding.severity),
              )}
            >
              {finding.severity}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{finding.description}</p>
          <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm leading-relaxed text-slate-200">
            <span className="font-semibold text-brand-cyan">Fix: </span>
            {finding.recommendation}
          </p>
          {finding.affectedUrls && finding.affectedUrls.length > 0 ? (
            <p className="mt-2.5 text-xs text-slate-400">
              Affects {finding.affectedUrls.length} URL
              {finding.affectedUrls.length === 1 ? '' : 's'}
            </p>
          ) : null}
          {finding.docsUrl ? (
            <a
              href={finding.docsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-brand-cyan underline-offset-2 transition hover:text-cyan-200 hover:underline"
            >
              Learn more
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
                <path d="M7 17 17 7M7 7h10v10" />
              </svg>
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
