'use client';

/**
 * The single-URL entry point that sits above the 3D scene. Wraps the shared
 * `@aeo/ui` UrlInputForm (which normalizes the scheme and validates the URL) in
 * a glassy, themed bar. The page hero owns the single `<h1>`, so this is a plain
 * control surface (no heading) — it just labels the input for assistive tech.
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
    <div
      role="search"
      aria-label="Build a backlink graph"
      className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-white/[0.12] bg-ink-950/80 p-3 shadow-glow backdrop-blur-md sm:p-4"
    >
      <UrlInputForm
        onSubmit={onSubmit}
        loading={loading}
        submitLabel="Build graph"
        placeholder="example.com — enter any domain or URL"
        {...(defaultValue === undefined ? {} : { defaultValue })}
      />
      <p className="mt-2 px-1 text-xs text-slate-400">
        We map referring domains, backlink pages, and brand mentions in 3D.
      </p>
    </div>
  );
}
