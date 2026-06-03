import type { JSX, ReactNode } from 'react';
import { cx } from './utils.js';

export interface ReportLayoutProps {
  title: ReactNode;
  children: ReactNode;
  /** Optional subtitle / description rendered under the title. */
  subtitle?: ReactNode;
  /** Optional actions (buttons, download links) rendered in the header. */
  actions?: ReactNode;
  /** Extra Tailwind classes appended to the outer wrapper. */
  className?: string;
}

/**
 * Semantic page shell for audit/report screens: a `<header>` with title,
 * optional subtitle and actions, plus a `<main>` content region.
 * Presentational only — no data fetching or app logic.
 */
export function ReportLayout({
  title,
  children,
  subtitle,
  actions,
  className,
}: ReportLayoutProps): JSX.Element {
  return (
    <div className={cx('mx-auto w-full max-w-4xl px-4 py-8', className)}>
      <header className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      <main className="flex flex-col gap-6">{children}</main>
    </div>
  );
}
