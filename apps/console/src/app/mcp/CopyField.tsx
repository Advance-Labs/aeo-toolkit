'use client';

import { useCallback, useState, type JSX } from 'react';
import { cn } from '@/lib/cn';

/** Clipboard icon — inline SVG, no icon library (matches the toolkit's lean-bundle convention). */
function CopyIcon(): JSX.Element {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" strokeLinecap="round" />
    </svg>
  );
}

/** Check icon shown for the transient "Copied" confirmation. */
function CheckIcon(): JSX.Element {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Copy-to-clipboard control with a transient "Copied" confirmation.
 *
 * `variant='field'` (default) renders the value as a full-width monospace `<code>` row with a trailing
 * copy button — used for connection URLs. `variant='button'` renders a compact icon button only — used
 * beside a code block (e.g. the Cursor `mcp.json` snippet) where the value is already displayed.
 *
 * The copy button always carries an explicit `aria-label` (`label`) so screen-reader users know what
 * gets copied. Clipboard writes are guarded for environments without `navigator.clipboard`.
 */
export function CopyField({
  value,
  label,
  variant = 'field',
}: {
  /** The exact text copied to the clipboard. */
  value: string;
  /** Accessible description of what is copied, e.g. "AI Visibility MCP connection URL". */
  label: string;
  /** `field` shows the value inline; `button` is a compact icon-only control. */
  variant?: 'field' | 'button';
}): JSX.Element {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }, [value]);

  const button = (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy ${label}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
        copied
          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
          : 'border-white/12 bg-white/5 text-slate-300 hover:border-white/25 hover:text-white',
      )}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );

  if (variant === 'button') {
    return button;
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-950/60 p-2 pl-3">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-slate-200">
        {value}
      </code>
      {button}
    </div>
  );
}
