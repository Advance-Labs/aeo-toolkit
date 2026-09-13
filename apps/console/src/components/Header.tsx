'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLockup } from './BrandMark';
import { cn } from '@/lib/cn';

/** Solid drafting-ink CTA — the v2 accent, replacing the old gradient pill. */
const CTA_CLASSES =
  'v2-cta inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-semibold';

const NAV = [
  { href: '/tools/audit', label: 'Audit' },
  { href: '/tools/eeat', label: 'E-E-A-T' },
  { href: '/tools/llms-txt', label: 'llms.txt' },
  { href: '/tools/chat', label: 'GA4 + GSC' },
  { href: '/tools/graph', label: 'Graph' },
  { href: '/mcp', label: 'MCP' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
];

/** The drawer groups the same routes by kind — instruments first, then the site. */
const DRAWER_GROUPS: ReadonlyArray<{ heading: string; items: typeof NAV }> = [
  { heading: 'Tools', items: NAV.slice(0, 5) },
  { heading: 'Site', items: NAV.slice(5) },
];

export function Header(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  // Route change closes the drawer.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  // While open: Escape closes, and the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const linkClasses = (active: boolean): string =>
    cn(
      'rounded px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition',
      active
        ? 'bg-[#A8F326]/10 text-[#C3FF57]'
        : 'text-[#A8F326]/85 hover:bg-[#A8F326]/5 hover:text-[#C3FF57]',
    );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0a0a0b]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="AEO Toolkit home" className="shrink-0">
            <BrandLockup size={22} tone="dark" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className={linkClasses(path === item.href)}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:block">
            <Link href="/tools/audit" className={CTA_CLASSES}>
              Run the audit
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-white/5 md:hidden"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* Slide-in drawer. A sibling of the header on purpose: the header's
          backdrop-blur (and the fold transform) would turn position:fixed inside it
          into header-relative positioning. */}
      <div
        aria-hidden={!open}
        className={cn('fixed inset-0 z-50 md:hidden', open ? '' : 'pointer-events-none')}
      >
        <div
          onClick={() => setOpen(false)}
          aria-hidden="true"
          className={cn(
            'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none',
            open ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className={cn(
            'absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-l border-white/10 bg-[#0d0d0f] shadow-[-24px_0_60px_rgba(0,0,0,0.55)]',
            'transition-transform duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
            open ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-white/[0.07] pl-5 pr-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#9a9aa6]">
              Menu
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-white/5"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-6">
            {DRAWER_GROUPS.map((group) => (
              <div key={group.heading} className="flex flex-col gap-1">
                <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#9a9aa6]">
                  {group.heading}
                </p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(linkClasses(path === item.href), 'py-2.5')}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <div className="border-t border-white/[0.07] p-5">
            <Link
              href="/tools/audit"
              onClick={() => setOpen(false)}
              className={cn(CTA_CLASSES, 'w-full justify-center')}
            >
              Run the audit
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
