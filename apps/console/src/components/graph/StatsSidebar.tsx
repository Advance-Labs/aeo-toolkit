'use client';

/**
 * Side-rail panel summarising the aggregate {@link BacklinkGraphStats}: how many
 * referring domains + backlinks were discovered, the dofollow ratio, and the top
 * link sources. Always carries the "sampled, not a complete index" disclaimer so
 * the data is read as directional rather than exhaustive.
 */
import type { JSX } from 'react';
import type { BacklinkGraphStats } from '@advance-labs/backlinks';

export interface StatsSidebarProps {
  stats: BacklinkGraphStats;
  /** Non-fatal provider warnings surfaced by the engine, if any. */
  warnings?: string[];
}

export function StatsSidebar({ stats, warnings }: StatsSidebarProps): JSX.Element {
  const dofollowPct = Math.round(clamp(stats.dofollowRatio, 0, 1) * 100);

  return (
    <section
      aria-label="Graph statistics"
      className="flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-ink-900/80 p-4 text-sm text-slate-200 shadow-xl backdrop-blur-md"
    >
      <div className="grid grid-cols-2 gap-2.5">
        <Metric
          label="Referring domains"
          value={formatCount(stats.referringDomains)}
          accent="indigo"
        />
        <Metric label="Backlinks" value={formatCount(stats.backlinks)} accent="violet" />
        <Metric label="Dofollow" value={`${dofollowPct}%`} accent="cyan" />
        <Metric label="Source" value="Open indexes" accent="neutral" />
      </div>

      {stats.topSources.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Top sources
          </h3>
          <ol className="flex flex-col gap-1.5">
            {stats.topSources.slice(0, 8).map((source, index) => (
              <li
                key={source.domain}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/[0.04]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-slate-600">
                    {index + 1}
                  </span>
                  <span className="truncate text-slate-200">{source.domain}</span>
                </span>
                <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] tabular-nums text-slate-300">
                  {source.count}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {warnings !== undefined && warnings.length > 0 ? (
        <details className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-2.5 text-xs text-amber-200">
          <summary className="cursor-pointer select-none font-medium">
            {warnings.length} provider warning{warnings.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-amber-200/90">
            {warnings.map((warning, index) => (
              <li key={`${index}-${warning.slice(0, 24)}`}>{warning}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="border-t border-white/10 pt-3 text-xs leading-relaxed text-slate-400">
        Discovered from open indexes (DuckDuckGo, CommonCrawl, Wayback). This is a{' '}
        <strong className="font-semibold text-slate-300">sample</strong>, not a complete index like
        a paid tool — treat it as directional.
      </p>
    </section>
  );
}

type Accent = 'indigo' | 'violet' | 'cyan' | 'neutral';

const ACCENT_RING: Record<Accent, string> = {
  indigo: 'before:bg-brand-indigo',
  violet: 'before:bg-brand-violet',
  cyan: 'before:bg-brand-cyan',
  neutral: 'before:bg-slate-500',
};

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: Accent;
}): JSX.Element {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full ${ACCENT_RING[accent]}`}
    >
      <span className="block text-lg font-semibold tabular-nums text-white">{value}</span>
      <span className="mt-0.5 block text-[11px] text-slate-400">{label}</span>
    </div>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(Math.max(0, Math.round(value)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
