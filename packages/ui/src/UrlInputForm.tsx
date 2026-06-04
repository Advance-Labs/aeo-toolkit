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
      <div className="flex w-full flex-col items-stretch gap-2.5 sm:flex-row">
        <label className="sr-only" htmlFor="aeo-url-input">
          Website URL
        </label>
        <div className="relative flex-1">
          {/* Leading globe glyph for affordance. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
            </svg>
          </span>
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
            className={cx(
              'w-full rounded-xl border bg-white/[0.03] py-3 pl-11 pr-4 text-sm text-white shadow-inner outline-none backdrop-blur-sm transition',
              'placeholder:text-slate-400',
              'focus:border-brand-indigo/60 focus:bg-white/[0.05] focus:ring-2 focus:ring-brand-indigo/30',
              'disabled:cursor-not-allowed disabled:opacity-60',
              error !== null ? 'border-red-400/60 focus:ring-red-400/30' : 'border-white/12',
            )}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className={cx(
            'group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-glow transition',
            'bg-gradient-to-r from-brand-indigo via-brand-violet to-brand-cyan bg-[length:200%_100%] bg-left',
            'hover:bg-right hover:shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_22px_60px_-18px_rgba(99,102,241,0.65)]',
            'focus-visible:ring-2 focus-visible:ring-brand-cyan/50',
            'disabled:cursor-not-allowed disabled:opacity-70',
          )}
        >
          {loading ? (
            <>
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeOpacity="0.3"
                  strokeWidth="3"
                />
                <path
                  d="M21 12a9 9 0 0 0-9-9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              Analyzing…
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
      {error !== null ? (
        <p id="aeo-url-error" role="alert" className="text-sm font-medium text-red-300">
          {error}
        </p>
      ) : null}
    </form>
  );
}
