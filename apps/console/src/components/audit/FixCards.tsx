import type { Finding } from '@advance-labs/types';
import type { JSX } from 'react';
import { cn } from '@/lib/cn';
import { severityChipClasses, severityRank } from './findingHelpers';

export function FixCards({ findings }: { findings: Finding[] }): JSX.Element {
  const sorted = [...findings.filter((finding) => !finding.passed)].sort((a, b) => {
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

const URLS_SHOWN_INLINE = 3;

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
