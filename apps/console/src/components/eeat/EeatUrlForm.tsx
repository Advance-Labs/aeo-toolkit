'use client';

import { useId, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface EeatUrlFormProps {
  /** Called with the trimmed, scheme-normalized URL when the form validates. */
  onSubmit: (url: string) => void;
  /** Disables the field + button and shows the busy label while a scan is running. */
  loading?: boolean;
  /** Placeholder for the empty input. */
  placeholder?: string;
  /** Submit button label in the idle state. */
  submitLabel?: string;
  /** Extra classes appended to the form element. */
  className?: string;
}

/**
 * Prepend `https://` when the user omits a scheme so consumers always receive a
 * parseable absolute URL. Mirrors the normalization the shared form used to do.
 */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Dark, design-system URL entry form for the E-E-A-T Scanner. Functionally
 * identical to the shared `UrlInputForm` (same non-empty check, scheme
 * normalization, and `new URL()` validation) but styled with the console
 * `Input`/`Button` primitives instead of the light shared widget.
 */
export function EeatUrlForm({
  onSubmit,
  loading = false,
  placeholder = 'example.com',
  submitLabel = 'Scan E-E-A-T',
  className,
}: EeatUrlFormProps): JSX.Element {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

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
      className={cn('flex w-full flex-col gap-3', className)}
      noValidate
    >
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch">
        <label className="sr-only" htmlFor={inputId}>
          Website URL
        </label>
        <div className="relative flex-1">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          >
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
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </span>
          <Input
            id={inputId}
            name="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            value={value}
            disabled={loading}
            placeholder={placeholder}
            aria-invalid={error !== null}
            aria-describedby={error !== null ? errorId : undefined}
            onChange={(event) => setValue(event.target.value)}
            className="pl-11"
          />
        </div>
        <Button type="submit" size="lg" disabled={loading} className="sm:w-auto">
          {loading ? (
            <>
              <Spinner />
              Scanning…
            </>
          ) : (
            <>
              {submitLabel}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </>
          )}
        </Button>
      </div>
      {error !== null ? (
        <p id={errorId} role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** Small inline spinner shown on the submit button while a scan runs. */
function Spinner(): JSX.Element {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
