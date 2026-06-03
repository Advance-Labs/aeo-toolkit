'use client';

import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { UrlInputForm } from '@aeo/ui';
import type { GenerateErrorResponse, GenerateResponse } from '@/lib/types';

interface FileOutput {
  filename: string;
  content: string;
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

function FileCard({ file }: { file: FileOutput }): JSX.Element {
  const onDownload = useCallback(() => downloadText(file.filename, file.content), [file]);
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-sm font-semibold text-slate-900">{file.filename}</h2>
        <button
          type="button"
          onClick={onDownload}
          className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-slate-700"
        >
          Download {file.filename}
        </button>
      </div>
      <textarea
        readOnly
        value={file.content}
        spellCheck={false}
        aria-label={file.filename}
        className="h-72 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
      />
    </section>
  );
}

export function GeneratorView(): JSX.Element {
  const [includeFull, setIncludeFull] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const handleSubmit = useCallback(
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

  const files: FileOutput[] = [];
  if (result) {
    files.push({ filename: 'llms.txt', content: result.llmsTxt });
    if (result.llmsFullTxt !== undefined) {
      files.push({ filename: 'llms-full.txt', content: result.llmsFullTxt });
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">llms.txt Generator</h1>
        <p className="text-sm text-slate-600">
          Enter a site URL. We crawl its pages (sitemap-first), extract titles and descriptions, and
          generate a structured{' '}
          <a
            href="https://llmstxt.org"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-sky-700 underline"
          >
            llms.txt
          </a>{' '}
          file for you to download.
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <UrlInputForm onSubmit={handleSubmit} loading={loading} submitLabel="Generate" />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={includeFull}
            disabled={loading}
            onChange={(event) => setIncludeFull(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-200"
          />
          Also generate <span className="font-mono">llms-full.txt</span> (expanded content variant)
        </label>
      </div>

      {error !== null ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-slate-600">
            Crawled <span className="font-medium">{result.url}</span> — {result.pageCount} page
            {result.pageCount === 1 ? '' : 's'} included.
          </p>
          {files.map((file) => (
            <FileCard key={file.filename} file={file} />
          ))}
        </div>
      ) : null}
    </main>
  );
}
