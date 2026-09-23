'use client';

import { useState, useId } from 'react';
import type { FormEvent, JSX } from 'react';
import { Button, Input } from '@/components/ui';

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function GlobeIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" />
    </svg>
  );
}

function ArrowIcon(): JSX.Element {
  return (
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
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Spinner(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function AuditInputCard({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (url: string) => void;
}): JSX.Element {
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
      new URL(normalized);
    } catch {
      setError('That does not look like a valid URL.');
      return;
    }
    setError(null);
    onSubmit(normalized);
  }

  return (
    <div className="surface relative overflow-hidden p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-brand-violet/15 blur-3xl"
      />
      <form onSubmit={handleSubmit} className="relative flex flex-col gap-3" noValidate>
        <label htmlFor={inputId} className="text-sm font-medium text-slate-200">
          Website URL
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <GlobeIcon />
            </span>
            <Input
              id={inputId}
              name="url"
              type="text"
              inputMode="url"
              autoComplete="url"
              value={value}
              disabled={loading}
              placeholder="example.com"
              aria-invalid={error !== null}
              aria-describedby={error !== null ? errorId : undefined}
              onChange={(event) => setValue(event.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" size="lg" disabled={loading} className="sm:w-auto">
            {loading ? (
              <>
                <Spinner />
                Running audit…
              </>
            ) : (
              <>
                Run audit
                <ArrowIcon />
              </>
            )}
          </Button>
        </div>
        {error !== null ? (
          <p id={errorId} role="alert" className="text-sm text-red-300">
            {error}
          </p>
        ) : (
          <p className="text-xs text-slate-400">
            Crawls up to 50 pages. No sign-up, and we never store your site content — your report
            renders right here.
          </p>
        )}
      </form>
    </div>
  );
}
