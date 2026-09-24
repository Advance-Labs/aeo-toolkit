'use client';

import { useCallback, useId, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { ThinkingOrb } from 'thinking-orbs';
import { Button, Input, SpotlightCard } from '@/components/ui';
import { describeAuthority } from '@/lib/authority-bands';
import { cn } from '@/lib/cn';

/* ── Wire types. Mirrors `@/lib/authority`, re-declared so the client bundle does
      not pull in the server module (and its `process.env` access) by accident. ── */

interface HistoryPoint {
  date: string;
  openPageRank: number;
  estimated: boolean;
}

interface AuthorityResult {
  domain: string;
  found: boolean;
  openPageRank: number | null;
  rank: number | null;
  referringDomains: number | null;
  history: HistoryPoint[];
}

interface AuthorityReport {
  asOf: string;
  source: string;
  results: AuthorityResult[];
  invalid: string[];
}

type ErrorCode =
  | 'not_configured'
  | 'bad_input'
  | 'upstream_rejected'
  | 'upstream_shape'
  | 'unreachable'
  | 'rate_limited'
  | 'quota_exhausted';

/**
 * One honest sentence per failure mode.
 *
 * None of these degrade to a number. A checker that renders "0" when the index is
 * unreachable has told the reader their site has no authority, which is a lie the
 * reader has no way to detect — the single worst thing this tool could do.
 */
const ERROR_COPY: Record<ErrorCode, string> = {
  not_configured:
    'The authority index is not connected on this deployment yet, so there is no score to show. This is our configuration, not your domain.',
  bad_input: 'That does not look like a domain. Try something like advancelabs.dev.',
  upstream_rejected:
    'The authority index refused the lookup — usually its free monthly quota or a rate limit. Try again in a few minutes.',
  upstream_shape:
    'The authority index answered in a format this tool does not recognise, so there is no number we are willing to show you. We have been told; please try again later.',
  unreachable: 'The authority index did not respond in time. Try again in a moment.',
  rate_limited:
    'That is a lot of lookups from one address in a short window. The limit exists so the free quota lasts the month for everyone. Give it a few minutes and it will let you straight back in.',
  quota_exhausted:
    'This month\u2019s lookup budget for the free index is spent, so there is no number to show. Nothing is wrong with your domain and nothing is wrong with the checker: we have simply run out of calls until the quota resets.',
};

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && value in ERROR_COPY;
}

/** Format a rank as "4,812,003" — grouped, because seven unbroken digits are unreadable. */
function formatRank(rank: number): string {
  return rank.toLocaleString('en-US');
}

/**
 * A twelve-point sparkline of the monthly series.
 *
 * SC 1.1.1 / 1.4.11: the polyline carries a fact, so it gets `role="img"` with a
 * `<title>`/`<desc>`, is stroked in the signal colour (well over 3:1 on this ground),
 * and — critically — the same numbers are repeated as a real table in the sibling
 * `sr-only` block. A fact that exists only as a shape is neither accessible nor
 * quotable, which on an AEO tool would be self-refuting.
 */
function Sparkline({ points }: { points: readonly HistoryPoint[] }): JSX.Element | null {
  const titleId = useId();
  const descId = useId();
  if (points.length < 2) return null;

  const width = 320;
  const height = 64;
  const pad = 4;
  const values = points.map((p) => p.openPageRank);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series must render as a flat line through the middle, not divide by zero.
  const span = max - min || 1;

  const d = points
    .map((p, i) => {
      const x = pad + (i * (width - pad * 2)) / (points.length - 1);
      const y = height - pad - ((p.openPageRank - min) / span) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const first = points[0];
  const last = points[points.length - 1];
  const direction =
    last!.openPageRank > first!.openPageRank
      ? 'rising'
      : last!.openPageRank < first!.openPageRank
        ? 'falling'
        : 'flat';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-16 w-full"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      preserveAspectRatio="none"
    >
      <title id={titleId}>Open PageRank over the last {points.length} months</title>
      <desc id={descId}>
        A {direction} line from {first!.openPageRank.toFixed(2)} in {first!.date} to{' '}
        {last!.openPageRank.toFixed(2)} in {last!.date}. The same figures are listed in the table
        below.
      </desc>
      <path d={d} fill="none" stroke="#a8f326" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** The score, its rank, and its referring-domain count. */
function ResultCard({ result, asOf }: { result: AuthorityResult; asOf: string }): JSX.Element {
  const { domain, found, openPageRank, rank, referringDomains, history } = result;

  return (
    <SpotlightCard className="p-6 sm:p-8">
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-slate-400">
        Open PageRank · graph of {asOf}
      </p>

      <h3 className="mt-2 break-all font-mono text-lg text-white">{domain}</h3>

      {found && openPageRank !== null ? (
        <>
          <p className="mt-6 flex items-baseline gap-2">
            <span className="text-6xl font-semibold tabular-nums text-white sm:text-7xl">
              {openPageRank.toFixed(2)}
            </span>
            <span className="text-2xl text-slate-400">/ 10</span>
          </p>
          {/*
            The band. Cut points live in `describeAuthority()` and are spaced to the
            index's real distribution, not arithmetic thirds.

            Rendered in the card's existing white/slate only, with no colour coding:
            the mapping never returns a 'warn' tone by design, so painting bands
            green-to-red would invent a severity the verdict deliberately withholds.
          */}
          {(() => {
            const verdict = describeAuthority(openPageRank);
            return (
              <>
                <p className="mt-2 text-lg text-white">{verdict.band}</p>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
                  {verdict.meaning}
                </p>
              </>
            );
          })()}

          <dl className="mt-8 grid gap-6 border-t border-white/[0.08] pt-6 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-slate-400">
                Rank in the graph
              </dt>
              <dd className="mt-1 text-xl tabular-nums text-white">
                {rank === null ? 'Not published' : formatRank(rank)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-slate-400">
                Referring domains
              </dt>
              <dd className="mt-1 text-xl tabular-nums text-white">
                {referringDomains === null ? 'Not published' : formatRank(referringDomains)}
              </dd>
            </div>
          </dl>

          {history.length >= 2 && (
            <div className="mt-8 border-t border-white/[0.08] pt-6">
              <p className="text-xs uppercase tracking-[0.08em] text-slate-400">
                {history.length} months of history
              </p>
              <div className="mt-3">
                <Sparkline points={history} />
              </div>
              {/*
                The chart's numbers, as text. Wrapped in a div, never `sr-only` on the
                <table> itself: a table with `table-layout: auto` sizes to its content
                and ignores width:1px, which pushes the page into horizontal scroll.
              */}
              <div className="sr-only">
                <table>
                  <caption>Open PageRank by month for {domain}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Month</th>
                      <th scope="col">Open PageRank</th>
                      <th scope="col">Observed or estimated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((point) => (
                      <tr key={point.date}>
                        <th scope="row">{point.date}</th>
                        <td>{point.openPageRank.toFixed(2)}</td>
                        <td>{point.estimated ? 'Estimated' : 'Observed'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 font-mono text-xs text-slate-400">
                {history[0]!.date} · {history[0]!.openPageRank.toFixed(2)} →{' '}
                {history[history.length - 1]!.date} ·{' '}
                {history[history.length - 1]!.openPageRank.toFixed(2)}
              </p>
            </div>
          )}
        </>
      ) : (
        /*
          "Absent from the graph" is a real answer, not a zero. New domains and sites
          with no inbound links legitimately have no node, and saying so is accurate
          where rendering 0.00 would be a fabricated measurement.
        */
        <div className="mt-6 border-t border-white/[0.08] pt-6">
          <p className="text-[15px] text-white">This domain is not in the graph.</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            That is not a score of zero — it means no link to this domain was found in the public
            crawl the graph is built from. It is the normal result for a new site, a site with no
            inbound links, or one that blocks crawlers.
          </p>
        </div>
      )}
    </SpotlightCard>
  );
}

/**
 * The Website Authority Checker's interactive island.
 *
 * The page around it is server-rendered and complete without JavaScript: this
 * component adds the lookup, nothing the explainer, HowTo or FAQ depend on.
 */
export function AuthorityView(): JSX.Element {
  const fieldId = useId();
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuthorityReport | null>(null);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = domain.trim();
      if (value === '' || loading) return;

      setLoading(true);
      setError(null);
      setReport(null);

      try {
        const response = await fetch('/api/authority', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domains: [value] }),
        });
        const payload: unknown = await response.json();

        if (!response.ok) {
          const code = (payload as { code?: unknown }).code;
          setError(isErrorCode(code) ? ERROR_COPY[code] : ERROR_COPY.unreachable);
          return;
        }
        setReport(payload as AuthorityReport);
      } catch {
        setError(ERROR_COPY.unreachable);
      } finally {
        setLoading(false);
      }
    },
    [domain, loading],
  );

  const result = report?.results[0];

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={fieldId} className="sr-only">
          Domain to check
        </label>
        <Input
          id={fieldId}
          name="domain"
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          placeholder="advancelabs.dev"
          autoComplete="url"
          spellCheck={false}
          className="font-mono sm:flex-1"
        />
        <Button type="submit" size="lg" disabled={loading || domain.trim() === ''}>
          {loading ? 'Checking…' : 'Check authority'}
        </Button>
      </form>

      {/*
        The orb reports real agent work — a query against an external index — which is
        the only thing DESIGN.md licenses it for. `searching` is the mapped state for
        "querying an index or API". It is aria-hidden because the visible label beside
        it already announces the phase; the role="status" wrapper announces the change.
      */}
      {loading && (
        <div className="flex items-center gap-3" role="status">
          <ThinkingOrb state="searching" size={20} theme="auto" aria-hidden="true" />
          <span className="text-sm text-slate-400">Querying the open link graph…</span>
        </div>
      )}

      {error !== null && (
        <p
          role="alert"
          className={cn(
            'rounded-xl border border-white/[0.12] bg-white/[0.04] px-5 py-4',
            'text-[15px] leading-relaxed text-white',
          )}
        >
          {error}
        </p>
      )}

      {result !== undefined && report !== null && <ResultCard result={result} asOf={report.asOf} />}
    </div>
  );
}
