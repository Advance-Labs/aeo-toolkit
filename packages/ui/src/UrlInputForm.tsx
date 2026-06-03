'use client';

import { useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { cx } from './utils.js';

export interface UrlInputFormProps {
  /** Called with the trimmed, normalized URL string when the form is submitted. */
  onSubmit: (url: string) => void;
  /** When true, the input and button are disabled and the button shows a busy label. */
  loading?: boolean;
  /** Placeholder shown in the empty input. */
  placeholder?: string;
  /** Submit button label (idle state). Defaults to "Analyze". */
  submitLabel?: string;
  /** Initial value of the input. */
  defaultValue?: string;
  /** Extra Tailwind classes appended to the form. */
  className?: string;
}

/**
 * Prepend `https://` when the user omits a scheme, so consumers always receive
 * a parseable absolute URL.
 */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Controlled URL entry form. Validates non-emptiness, normalizes the scheme,
 * and calls `onSubmit` with the typed URL. Interactive → client component.
 */
export function UrlInputForm({
  onSubmit,
  loading = false,
  placeholder = 'example.com',
  submitLabel = 'Analyze',
  defaultValue = '',
  className,
}: UrlInputFormProps): JSX.Element {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalized = normalizeUrl(value);
    if (normalized === '') {
      setError('Please enter a URL.');
      return;
    }
    try {
      // Throws on a structurally invalid URL — surfaced as inline validation.
      new URL(normalized);
    } catch {
      setError('That does not look like a valid URL.');
      return;
    }
    setError(null);
    onSubmit(normalized);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cx('flex w-full flex-col gap-2', className)}
      noValidate
    >
      <div className="flex w-full items-stretch gap-2">
        <label className="sr-only" htmlFor="aeo-url-input">
          Website URL
        </label>
        <input
          id="aeo-url-input"
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          value={value}
          disabled={loading}
          placeholder={placeholder}
          aria-invalid={error !== null}
          aria-describedby={error !== null ? 'aeo-url-error' : undefined}
          onChange={(event) => setValue(event.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Analyzing…' : submitLabel}
        </button>
      </div>
      {error !== null ? (
        <p id="aeo-url-error" role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </form>
  );
}
