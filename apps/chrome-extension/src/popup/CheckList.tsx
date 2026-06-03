import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import type { CheckRow } from '../lib/types.js';

export interface CheckListProps {
  rows: CheckRow[];
}

type Filter = 'all' | 'failed' | 'passed';

/** Scrollable list of audit checks with a pass/fail filter; failures first. */
export function CheckList({ rows }: CheckListProps): JSX.Element {
  const [filter, setFilter] = useState<Filter>('all');

  const ordered = useMemo(() => {
    const byFailFirst = [...rows].sort((a, b) => {
      if (a.passed !== b.passed) return a.passed ? 1 : -1;
      return a.category.localeCompare(b.category);
    });
    if (filter === 'failed') return byFailFirst.filter((r) => !r.passed);
    if (filter === 'passed') return byFailFirst.filter((r) => r.passed);
    return byFailFirst;
  }, [rows, filter]);

  return (
    <section className="checklist">
      <div className="checklist-tabs" role="tablist">
        {(['all', 'failed', 'passed'] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={filter === f ? 'tab tab-active' : 'tab'}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <ul className="check-rows">
        {ordered.map((row) => (
          <li key={row.id} className={row.passed ? 'check check-pass' : 'check check-fail'}>
            <span className="check-icon" aria-hidden="true">
              {row.passed ? '✓' : '✕'}
            </span>
            <div className="check-body">
              <div className="check-title">{row.title}</div>
              {!row.passed && <div className="check-rec">{row.recommendation}</div>}
              <div className="check-cat">
                {row.category} · {row.severity}
              </div>
            </div>
          </li>
        ))}
        {ordered.length === 0 && <li className="check-empty">No checks in this view.</li>}
      </ul>
    </section>
  );
}
