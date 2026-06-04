'use client';

import { useCallback, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { Badge, Button, Input, Reveal, SpotlightCard } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { GenerateErrorResponse, GenerateResponse } from '@/components/llms-txt/types.js';

interface FileOutput {
  filename: string;
  content: string;
  /** Short human label describing the variant. */
  label: string;
}

/** Trigger a client-side download of a text file via a transient object URL. */
function downloadText(filename: string, content: string): void {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
}

/**
 * Prepend `https://` when the user omits a scheme so the API always receives a
 * parseable absolute URL. Mirrors the normalization the shared form used to do.
 */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Inline SVG icon set — no icon library (keeps the bundle lean). */
function CopyIcon(): JSX.Element {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" strokeLinecap="round" />
    </svg>
  );
}
function CheckIcon(): JSX.Element {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function DownloadIcon(): JSX.Element {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function FileIcon(): JSX.Element {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
      <path d="M14 3v5h5" strokeLinejoin="round" />
    </svg>
  );
}
function SpinnerIcon(): JSX.Element {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4 animate-spin"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
    >
      <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
    </svg>
  );
}

/** Small copy-to-clipboard button with a transient "Copied" confirmation. */
function CopyButton({ content, label }: { content: string; label: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }, [content]);
  return (
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
}

/** A polished output panel: filename tab, copy + download, and a dark mono code block. */
function OutputCard({ file }: { file: FileOutput }): JSX.Element {
  const onDownload = useCallback(() => downloadText(file.filename, file.content), [file]);
  const lines = file.content.split('\n');
  const lineCount = lines.length;

  return (
    <div className="surface overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-white/[0.02] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-xs font-semibold text-brand-cyan">
            <FileIcon />
            {file.filename}
          </span>
          <span className="hidden text-xs text-slate-400 sm:inline">
            {file.label} · {lineCount} line{lineCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton content={file.content} label={file.filename} />
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/25 hover:text-white"
          >
            <DownloadIcon />
            Download
          </button>
        </div>
      </div>
      {/* Code block with line numbers */}
      <div className="max-h-[28rem] overflow-auto bg-[#070912]/80">
        <pre className="flex min-w-full text-[12.5px] leading-relaxed">
          <code
            aria-hidden
            className="select-none border-r border-white/5 px-3 py-4 text-right font-mono text-slate-600"
          >
            {lines.map((_, i) => (
              <span key={i} className="block tabular-nums">
                {i + 1}
              </span>
            ))}
          </code>
          <code className="flex-1 whitespace-pre px-4 py-4 font-mono text-slate-200">
            {file.content}
          </code>
        </pre>
      </div>
    </div>
  );
}

/**
 * llms.txt Generator tool view. Re-homed from the standalone `llms-txt-generator`
 * app, restyled to the dark console design system. The shell layout provides the
 * page `<main>`; this renders the interactive island only (the page shell supplies
 * the hero, explainer, and FAQ). Calls `POST /api/generate`.
 */
export function GeneratorView(): JSX.Element {
  const [value, setValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [includeFull, setIncludeFull] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const generate = useCallback(
    async (url: string) => {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url, full: includeFull }),
        });
        const data: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof data === 'object' && data !== null && 'error' in data
              ? String((data as GenerateErrorResponse).error)
              : `Request failed (${response.status}).`;
          setError(message);
          return;
        }
        setResult(data as GenerateResponse);
      } catch {
        setError('Could not reach the generator. Is the server running?');
      } finally {
        setLoading(false);
      }
    },
    [includeFull],
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const normalized = normalizeUrl(value);
      if (normalized === '') {
        setFormError('Please enter a URL.');
        return;
      }
      try {
        // Throws on a structurally invalid URL — surfaced as inline validation.
        new URL(normalized);
      } catch {
        setFormError('That does not look like a valid URL.');
        return;
      }
      setFormError(null);
      void generate(normalized);
    },
    [value, generate],
  );

  const files: FileOutput[] = [];
  if (result) {
    files.push({ filename: 'llms.txt', content: result.llmsTxt, label: 'Curated link map' });
    if (result.llmsFullTxt !== undefined) {
      files.push({
        filename: 'llms-full.txt',
        content: result.llmsFullTxt,
        label: 'Expanded content',
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Generator form */}
      <SpotlightCard className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1">
              <label
                htmlFor="llms-url"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400"
              >
                Website URL
              </label>
              <Input
                id="llms-url"
                name="url"
                type="text"
                inputMode="url"
                autoComplete="url"
                placeholder="example.com"
                value={value}
                disabled={loading}
                aria-invalid={formError !== null}
                aria-describedby={formError !== null ? 'llms-url-error' : undefined}
                onChange={(event) => setValue(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full sm:mt-[1.625rem] sm:w-auto"
            >
              {loading ? (
                <>
                  <SpinnerIcon />
                  Generating…
                </>
              ) : (
                'Generate'
              )}
            </Button>
          </div>

          {formError !== null ? (
            <p id="llms-url-error" role="alert" className="text-sm text-rose-300">
              {formError}
            </p>
          ) : null}

          <label
            className={cn(
              'group inline-flex cursor-pointer select-none items-center gap-2.5 text-sm text-slate-300',
              loading && 'cursor-not-allowed opacity-60',
            )}
          >
            <span className="relative inline-flex h-5 w-5 items-center justify-center">
              <input
                type="checkbox"
                checked={includeFull}
                disabled={loading}
                onChange={(event) => setIncludeFull(event.target.checked)}
                className="peer h-5 w-5 appearance-none rounded-md border border-white/15 bg-white/5 outline-none transition checked:border-brand-cyan/60 checked:bg-brand-cyan/20 focus-visible:ring-2 focus-visible:ring-brand-cyan/30"
              />
              <CheckIcon />
            </span>
            <span>
              Also generate <span className="font-mono text-brand-cyan">llms-full.txt</span>{' '}
              <span className="text-slate-400">(expanded content variant)</span>
            </span>
          </label>
        </form>
      </SpotlightCard>

      {/* Error state */}
      {error !== null ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3.5 text-sm text-rose-200"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="mt-0.5 h-5 w-5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5m0 3h.01" strokeLinecap="round" />
          </svg>
          <span>{error}</span>
        </div>
      ) : null}

      {/* Loading skeleton */}
      {loading && result === null && error === null ? (
        <div className="surface overflow-hidden" aria-hidden>
          <div className="flex items-center justify-between border-b border-white/8 bg-white/[0.02] px-4 py-3">
            <div className="h-6 w-28 animate-pulse rounded-lg bg-white/8" />
            <div className="h-7 w-20 animate-pulse rounded-lg bg-white/8" />
          </div>
          <div className="space-y-2.5 p-5">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-3 animate-pulse rounded bg-white/6"
                style={{ width: `${[92, 70, 84, 55, 78, 64, 88, 48][i] ?? 70}%` }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Empty state */}
      {!loading && result === null && error === null ? (
        <div className="surface flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-brand-cyan">
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path
                d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
                strokeLinejoin="round"
              />
              <path d="M14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-200">
            Your generated llms.txt will appear here
          </p>
          <p className="max-w-sm text-sm text-slate-400">
            Enter a site URL above and we&apos;ll crawl it (sitemap-first), extract titles and
            descriptions, and assemble a ready-to-ship file.
          </p>
        </div>
      ) : null}

      {/* Result */}
      {result ? (
        <Reveal className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2.5 text-sm text-slate-400">
            <Badge tone="violet">Done</Badge>
            <span>
              Crawled <span className="font-medium text-slate-200">{result.url}</span> —{' '}
              <span className="font-medium text-slate-200">{result.pageCount}</span> page
              {result.pageCount === 1 ? '' : 's'} included.
            </span>
          </div>
          {files.map((file) => (
            <OutputCard key={file.filename} file={file} />
          ))}
        </Reveal>
      ) : null}
    </div>
  );
}
