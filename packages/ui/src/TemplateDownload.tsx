'use client';

import { useCallback } from 'react';
import type { JSX } from 'react';
import type { GeneratedTemplate } from '@aeo/types';
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
      className={cx('rounded-lg border border-slate-200 bg-white p-4 shadow-sm', className)}
      aria-label={`Generated ${template.filename}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-mono text-sm font-semibold text-slate-900">{template.filename}</h3>
          <p className="text-xs text-slate-500">{template.reason}</p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-slate-700"
        >
          Download
        </button>
      </div>
      <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">
        <code>{template.content}</code>
      </pre>
    </section>
  );
}
