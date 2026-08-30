'use client';

import { useCallback } from 'react';
import type { JSX } from 'react';
import type { GeneratedTemplate } from '@advance-labs/types';
import { cx } from './utils.js';

export interface TemplateDownloadProps {
  template: GeneratedTemplate;
  /**
   * Optional override for the download mechanism — injected so the
   * Blob/URL/anchor side effect can be unit-tested without a real DOM download.
   * Receives the template and is responsible for delivering the file.
   */
  onDownload?: (template: GeneratedTemplate) => void;
  /** Extra Tailwind classes appended to the wrapper. */
  className?: string;
}

/**
 * Trigger a client-side file download for the given template content using a
 * Blob and a transient object URL. Isolated so it can be replaced in tests.
 */
function downloadViaBlob(template: GeneratedTemplate): void {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return;
  }
  const blob = new Blob([template.content], { type: template.contentType });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = template.filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
}

/**
 * Renders a generated file (e.g. `robots.txt`, `llms.txt`) as a labelled code
 * block with a reason and a "Download" action. The download side effect is
 * injectable via `onDownload` for testability.
 */
export function TemplateDownload({
  template,
  onDownload,
  className,
}: TemplateDownloadProps): JSX.Element {
  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload(template);
      return;
    }
    downloadViaBlob(template);
  }, [onDownload, template]);

  return (
    <section
      className={cx(
        'overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-sm backdrop-blur-sm',
        className,
      )}
      aria-label={`Generated ${template.filename}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="flex items-center gap-2 font-mono text-sm font-semibold text-white">
            <span aria-hidden="true" className="text-brand-cyan">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
              </svg>
            </span>
            {template.filename}
          </h3>
          <p className="truncate text-xs text-slate-400">{template.reason}</p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className={cx(
            'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-glow transition',
            'bg-gradient-to-r from-brand-indigo to-brand-violet',
            'hover:brightness-110 focus-visible:ring-2 focus-visible:ring-brand-cyan/50',
          )}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Download
        </button>
      </div>
      <pre className="max-h-72 overflow-auto bg-ink-950/60 p-4 text-xs leading-relaxed text-slate-300">
        <code className="font-mono">{template.content}</code>
      </pre>
    </section>
  );
}
