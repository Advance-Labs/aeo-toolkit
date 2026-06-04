'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@aeo/ui';
import { Button } from './ui/Button';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/tools/audit', label: 'Audit' },
  { href: '/tools/eeat', label: 'E-E-A-T' },
  { href: '/tools/llms-txt', label: 'llms.txt' },
  { href: '/tools/chat', label: 'GA4 + GSC' },
  { href: '/tools/graph', label: 'Graph' },
];

export function Header(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="AEO Toolkit home" className="shrink-0">
          <Logo size={26} variant="dark" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = path === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition',
                  active ? 'bg-white/[0.06] text-white' : 'text-slate-400 hover:text-white',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <Button href="/tools/audit" size="sm">
            Run a free audit
          </Button>
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
        <div className="border-t border-white/[0.06] bg-ink-950/95 px-5 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <Button href="/tools/audit" size="sm" className="mt-2">
              Run a free audit
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
