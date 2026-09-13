'use client';

/**
 * The hero's focal asset: an authored specimen audit sheet. Honest by construction —
 * stamped SPECIMEN, illustrative data, no real domain graded. The pointer tilt is
 * additive (base state fully composed; touch/keyboard/blur all leave it neutral),
 * and the score numeral is counted up by the Motion system via [data-count].
 */

import { useCallback, useRef } from 'react';

interface CategoryRow {
  label: string;
  score: number;
}

/** Illustrative category scores for the specimen — clearly labeled as such in the UI. */
const CATEGORIES: ReadonlyArray<CategoryRow> = [
  { label: 'Crawlability', score: 92 },
  { label: 'Structured data', score: 100 },
  { label: 'Answer readiness', score: 88 },
  { label: 'Metadata', score: 74 },
  { label: 'E-E-A-T signals', score: 81 },
  { label: 'Content shape', score: 71 },
];

const OVERALL = 86;

export function SpecimenReport(): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse') return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--tilt-x', `${(-y * 3).toFixed(2)}deg`);
    el.style.setProperty('--tilt-y', `${(x * 4).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--sheen', '1');
  }, []);

  const reset = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
    el.style.setProperty('--sheen', '0');
  }, []);

  return (
    <div
      ref={ref}
      data-hero-sheet
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      onBlur={reset}
      className="v2-specimen v2-glass v2-brackets w-full max-w-md p-6 sm:p-7"
    >
      {/* Report header — mono metadata voice. */}
      <div className="flex items-baseline justify-between gap-4">
        <span className="v2-label">Audit report</span>
        <span className="v2-label" style={{ color: 'var(--v2-accent2)' }}>
          Specimen · illustrative
        </span>
      </div>

      <div className="v2-rule mt-3" data-rule aria-hidden="true" />

      {/* The score: the single biggest thing on the sheet. */}
      <div className="mt-5 flex items-end justify-between gap-4 sm:gap-6">
        <div>
          <div
            className="flex items-baseline font-[var(--font-v2-sans)] text-7xl font-bold leading-none tracking-tighter sm:text-8xl"
            aria-label={`Overall score ${OVERALL} out of 100`}
          >
            <span data-count={OVERALL}>{OVERALL}</span>
            <span className="text-2xl font-medium" style={{ color: 'var(--v2-ink-soft)' }}>
              /100
            </span>
          </div>
          <p className="v2-label mt-2 whitespace-nowrap">Overall · grade B</p>
        </div>
        {/* The meta column squeezes the score below sm — there it becomes the line under. */}
        <div className="hidden shrink-0 pb-1 text-right sm:block">
          <p className="v2-label whitespace-nowrap">54 rules</p>
          <p className="v2-label mt-1 whitespace-nowrap">12 pages crawled</p>
          <p className="v2-label mt-1 whitespace-nowrap">41s</p>
        </div>
      </div>
      <p className="v2-label mt-3 sm:hidden">54 rules · 12 pages crawled · 41s</p>

      {/* Category bars — an honest data graphic, not ornament. */}
      <dl className="mt-6 flex flex-col gap-2.5">
        {CATEGORIES.map((cat) => (
          <div key={cat.label} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3 sm:grid-cols-[9.5rem_1fr_2.5rem]">
            <dt className="v2-label truncate" style={{ color: 'var(--v2-ink-soft)' }}>
              {cat.label}
            </dt>
            <dd className="m-0">
              <div className="h-[3px] w-full bg-[color:var(--v2-rule)]">
                <div
                  className="h-full"
                  style={{
                    width: `${cat.score}%`,
                    background: cat.score >= 80 ? 'var(--v2-ok)' : 'var(--v2-warn)',
                  }}
                />
              </div>
            </dd>
            <dd
              className="m-0 text-right font-[var(--font-v2-mono)] text-xs tabular-nums"
              style={{ color: 'var(--v2-ink-soft)' }}
            >
              {cat.score}
            </dd>
          </div>
        ))}
      </dl>

      <div className="v2-rule mt-6" data-rule aria-hidden="true" />
      <p className="v2-label mt-3">
        Top fix · <span style={{ color: 'var(--v2-ink)' }}>add FAQPage JSON-LD to /pricing</span>
      </p>
    </div>
  );
}
