'use client';

/**
 * Overlay sidebar summarising the aggregate {@link BacklinkGraphStats}: how many
 * referring domains + backlinks were discovered, the dofollow ratio, and the top
 * link sources. Always carries the "sampled, not a complete index" disclaimer so
 * the data is read as directional rather than exhaustive.
 */
import type { JSX } from 'react';
import type { BacklinkGraphStats } from '@aeo/backlinks';

export interface StatsSidebarProps {
  stats: BacklinkGraphStats;
  /** Non-fatal provider warnings surfaced by the engine, if any. */
  warnings?: string[];
}

export function StatsSidebar({ stats, warnings }: StatsSidebarProps): JSX.Element {
  const dofollowPct = Math.round(clamp(stats.dofollowRatio, 0, 1) * 100);

  return (
    <aside
      aria-label="Graph statistics"
      className="pointer-events-auto flex w-72 max-w-[90vw] flex-col gap-4 rounded-xl border border-slate-700/60 bg-slate-900/90 p-4 text-sm text-slate-200 shadow-xl backdrop-blur"
    >
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Referring domains" value={formatCount(stats.referringDomains)} />
        <Metric label="Backlinks" value={formatCount(stats.backlinks)} />
        <Metric label="Dofollow" value={`${dofollowPct}%`} />
        <Metric label="Source" value="Open indexes" />
      </div>

      {stats.topSources.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Top sources
          </h3>
          <ol className="flex flex-col gap-1">
            {stats.topSources.slice(0, 8).map((source) => (
              <li key={source.domain} className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-200">{source.domain}</span>
                <span className="shrink-0 tabular-nums text-slate-400">{source.count}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {warnings !== undefined && warnings.length > 0 ? (
        <details className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-300">
          <summary className="cursor-pointer select-none">
            {warnings.length} provider warning{warnings.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
            {warnings.map((warning, index) => (
              <li key={`${index}-${warning.slice(0, 24)}`}>{warning}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="border-t border-slate-700/60 pt-3 text-xs leading-relaxed text-slate-500">
        Discovered backlinks from open indexes (DuckDuckGo, CommonCrawl, Wayback). This is a{' '}
        <strong className="text-slate-400">sample</strong>, not a complete index like a paid tool —
        treat it as directional.
      </p>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-slate-800/50 p-2">
      <span className="text-lg font-semibold tabular-nums text-slate-100">{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(Math.max(0, Math.round(value)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
