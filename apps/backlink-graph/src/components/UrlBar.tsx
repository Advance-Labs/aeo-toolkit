'use client';

/**
 * The single-URL entry point. Wraps the shared `@aeo/ui` UrlInputForm (which
 * normalizes the scheme and validates the URL) with the app's title + framing.
 */
import type { JSX } from 'react';
import { UrlInputForm } from '@aeo/ui';

export interface UrlBarProps {
  /** Called with the normalized, validated URL when submitted. */
  onSubmit: (url: string) => void;
  /** True while a graph build is in flight (disables the input + button). */
  loading?: boolean;
  /** Prefill value (e.g. the last analysed URL). */
  defaultValue?: string;
}

export function UrlBar({ onSubmit, loading = false, defaultValue }: UrlBarProps): JSX.Element {
  return (
    <div className="pointer-events-auto flex w-full max-w-xl flex-col gap-2 rounded-xl border border-slate-700/60 bg-slate-900/90 p-4 shadow-xl backdrop-blur">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">Backlink Graph</h1>
        <p className="text-xs text-slate-400">
          Enter one URL to explore its backlink universe in 3D.
        </p>
      </div>
      <UrlInputForm
        onSubmit={onSubmit}
        loading={loading}
        submitLabel="Build graph"
        placeholder="example.com"
        {...(defaultValue === undefined ? {} : { defaultValue })}
      />
    </div>
  );
}
