import type { JSX } from 'react';
import { EeatScanner } from '@/components/eeat/EeatScanner.js';

/**
 * E-E-A-T Scanner tool. Re-homed from the standalone `eeat-scanner` app. The shell
 * layout provides the page `<main>`, so this renders a local header + the interactive
 * `EeatScanner` island inside a plain wrapper (no nested `<main>` from `ReportLayout`).
 */
export default function EeatToolPage(): JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">E-E-A-T Scanner</h1>
        <p className="text-sm text-slate-400">
          Crawl up to 12 pages and score Experience, Expertise, Authoritativeness, and Trust.
        </p>
      </header>
      <EeatScanner />
    </div>
  );
}
