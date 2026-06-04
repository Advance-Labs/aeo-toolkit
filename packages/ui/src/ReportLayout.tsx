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
    <div className={cx('mx-auto w-full max-w-4xl px-4 py-8 sm:py-10', className)}>
      <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          {subtitle ? <p className="text-sm leading-relaxed text-slate-400">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <main className="flex flex-col gap-6">{children}</main>
    </div>
  );
}
