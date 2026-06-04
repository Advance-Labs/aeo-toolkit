'use client';

import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import type { EeatReport } from '@aeo/types';
import { GradeBadge } from '@aeo/ui';
import { requestEeatAudit } from '@/components/eeat/client.js';
import { EeatUrlForm } from '@/components/eeat/EeatUrlForm.js';
import { PillarCard } from '@/components/eeat/PillarCard.js';
import { ImprovementsList } from '@/components/eeat/ImprovementsList.js';
import { Card, Reveal } from '@/components/ui';
import { cn } from '@/lib/cn';

type Status = 'idle' | 'loading' | 'done' | 'error';

/**
 * The interactive heart of the E-E-A-T tool. Owns the scan lifecycle: takes a URL
 * from the form, calls the audit API, and renders the overall score plus one
 * `PillarCard` per E-E-A-T pillar and the improvements list. Logic is unchanged
 * from the original — only the presentation is the dark design system now.
 */
export function EeatScanner(): JSX.Element {
  const [status, setStatus] = useState<Status>('idle');
  const [report, setReport] = useState<EeatReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (url: string) => {
    setStatus('loading');
    setError(null);
    setReport(null);
    try {
      const result = await requestEeatAudit(url);
      setReport(result);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('error');
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <span aria-hidden="true" className="text-brand-cyan">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            Scan a URL
          </div>
          <EeatUrlForm
            onSubmit={(url) => {
              void handleSubmit(url);
            }}
            loading={status === 'loading'}
            submitLabel="Scan E-E-A-T"
            placeholder="example.com"
          />
          <p className="text-xs text-slate-500">
            We crawl up to 12 pages and never store your site content. Results are scored instantly.
          </p>
        </div>
      </Card>

      {status === 'loading' ? <LoadingState /> : null}

      {status === 'error' && error !== null ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-500/[0.08] px-5 py-4 text-sm text-red-200"
        >
          <span aria-hidden="true" className="mt-0.5 shrink-0 text-red-300">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </span>
          <span>{error}</span>
        </div>
      ) : null}

      {status === 'done' && report !== null ? <ReportView report={report} /> : null}
    </div>
  );
}

/** Skeleton + status copy shown while the crawl + scoring runs. */
function LoadingState(): JSX.Element {
  return (
    <Card>
      <div className="flex flex-col gap-5" aria-live="polite">
        <p role="status" className="flex items-center gap-2.5 text-sm text-slate-300">
          <span aria-hidden="true" className="text-brand-cyan">
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeOpacity="0.25"
                strokeWidth="3"
              />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Crawling up to 12 pages and scoring the four pillars…
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]"
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

/** Circular SVG ring rendering the overall 0–100 score with a brand gradient stroke. */
function ScoreRing({ score }: { score: number }): JSX.Element {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="eeat-score-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="55%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="9"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="url(#eeat-score-grad)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums text-white">{clamped}</span>
        <span className="text-[11px] uppercase tracking-wider text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

function ReportView({ report }: { report: EeatReport }): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <Card className="overflow-hidden">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-6">
              <ScoreRing score={report.overall} />
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-semibold text-white">Overall E-E-A-T</h2>
                  <GradeBadge grade={report.grade} size="md" />
                </div>
                <p className="text-sm text-slate-400">
                  <span className="break-all font-medium text-slate-200">{report.url}</span>
                </p>
                <p className="text-sm text-slate-500">
                  {report.pagesCrawled} page{report.pagesCrawled === 1 ? '' : 's'} scanned
                </p>
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-4">
              {report.pillars.map((pillar) => (
                <PillarStat key={pillar.key} label={pillar.label} score={pillar.score} />
              ))}
            </div>
          </div>
        </Card>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {report.pillars.map((pillar, i) => (
          <Reveal key={pillar.key} delay={i * 0.05}>
            <PillarCard pillar={pillar} />
          </Reveal>
        ))}
      </div>

      <Reveal>
        <ImprovementsList improvements={report.improvements} />
      </Reveal>
    </div>
  );
}

/** Compact per-pillar score chip shown alongside the overall ring. */
function PillarStat({ label, score }: { label: string; score: number }): JSX.Element {
  const tone = score >= 80 ? 'text-emerald-300' : score >= 50 ? 'text-amber-300' : 'text-red-300';
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
      <span className={cn('text-lg font-bold tabular-nums', tone)}>{score}</span>
      <span className="truncate text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
    </div>
  );
}
