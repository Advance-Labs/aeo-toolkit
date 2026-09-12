'use client';

import { useState } from 'react';
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

export function Header(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0a0a0b]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="AEO Toolkit home" className="shrink-0">
          <BrandLockup size={22} tone="dark" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = path === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition',
                  active
                    ? 'bg-[#A8F326]/10 text-[#C3FF57]'
                    : 'text-[#A8F326]/85 hover:bg-[#A8F326]/5 hover:text-[#C3FF57]',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <Link href="/tools/audit" className={CTA_CLASSES}>
            Run the audit
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
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
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <div className="border-t border-white/[0.06] bg-[#0a0a0b]/90 backdrop-blur-xl px-5 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#A8F326]/85 hover:bg-[#A8F326]/5 hover:text-[#C3FF57]"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/tools/audit" onClick={() => setOpen(false)} className={cn(CTA_CLASSES, 'mt-2 justify-center')}>
              Run the audit
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
