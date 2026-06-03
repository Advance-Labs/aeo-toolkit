'use client';

import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import type { EeatReport } from '@aeo/types';
import { UrlInputForm, GradeBadge } from '@aeo/ui';
import { requestEeatAudit } from '@/lib/client';
import { PillarCard } from './PillarCard';
import { ImprovementsList } from './ImprovementsList';

type Status = 'idle' | 'loading' | 'done' | 'error';

/**
 * The interactive heart of the home page. Owns the scan lifecycle: takes a URL
 * from `UrlInputForm`, calls the audit API, and renders one `PillarCard` per
 * E-E-A-T pillar plus the improvements list.
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
      <UrlInputForm
        onSubmit={(url) => {
          void handleSubmit(url);
        }}
        loading={status === 'loading'}
        submitLabel="Scan E-E-A-T"
        placeholder="example.com"
      />

      {status === 'loading' ? (
        <p role="status" className="text-sm text-slate-600">
          Crawling up to 12 pages and scoring the four pillars…
        </p>
      ) : null}

      {status === 'error' && error !== null ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {status === 'done' && report !== null ? <ReportView report={report} /> : null}
    </div>
  );
}

function ReportView({ report }: { report: EeatReport }): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-900">Overall E-E-A-T</h2>
          <p className="text-sm text-slate-600">
            <span className="break-all">{report.url}</span> · {report.pagesCrawled} page
            {report.pagesCrawled === 1 ? '' : 's'} scanned
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-4xl font-bold tabular-nums text-slate-900">{report.overall}</span>
          <span className="text-sm text-slate-400">/ 100</span>
          <GradeBadge grade={report.grade} size="lg" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {report.pillars.map((pillar) => (
          <PillarCard key={pillar.key} pillar={pillar} />
        ))}
      </div>

      <ImprovementsList improvements={report.improvements} />
    </div>
  );
}
