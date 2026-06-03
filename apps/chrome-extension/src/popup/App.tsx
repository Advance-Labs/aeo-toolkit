import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { toCheckRows } from '../lib/audit.js';
import { ScoreGauge } from './ScoreGauge.js';
import { CheckList } from './CheckList.js';
import { SiteFiles } from './SiteFiles.js';
import { exportAuditPdf } from './pdf.js';
import { useAudit } from './useAudit.js';

/** Root popup view: runs the audit on mount and renders score + checks + export. */
export function App(): JSX.Element {
  const { state, run } = useAudit();
  const [exportedAs, setExportedAs] = useState<string | null>(null);

  // Kick off the audit as soon as the popup opens. `run` is stable (useCallback
  // with a stable transport), so an empty dep array runs it exactly once.
  useEffect(() => {
    void run();
  }, [run]);

  const onExport = (): void => {
    if (state.status !== 'done') return;
    const filename = exportAuditPdf(state.payload);
    setExportedAs(filename);
  };

  return (
    <main className="app">
      <header className="app-header">
        <h1>AEO / GEO Auditor</h1>
        <button
          type="button"
          className="rerun"
          onClick={() => void run()}
          disabled={state.status === 'running'}
        >
          {state.status === 'running' ? 'Auditing…' : 'Re-run'}
        </button>
      </header>

      {state.status === 'idle' && <p className="hint">Starting audit…</p>}

      {state.status === 'running' && (
        <div className="loading">
          <div className="spinner" aria-label="Running audit" />
          <p>Analyzing the active tab — fully client-side.</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="error" role="alert">
          <p>{state.error}</p>
          <button type="button" onClick={() => void run()}>
            Try again
          </button>
        </div>
      )}

      {state.status === 'done' && (
        <>
          <p className="audited-url" title={state.payload.pageUrl}>
            {state.payload.pageUrl}
          </p>
          <ScoreGauge score={state.payload.report.score} />
          <SiteFiles presence={state.payload.filePresence} />
          <CheckList rows={toCheckRows(state.payload)} />
          <footer className="app-footer">
            <button type="button" className="export" onClick={onExport}>
              Export PDF
            </button>
            {exportedAs !== null && <span className="exported">Saved {exportedAs}</span>}
          </footer>
        </>
      )}
    </main>
  );
}
