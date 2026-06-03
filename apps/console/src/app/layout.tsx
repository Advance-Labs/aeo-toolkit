import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@aeo/ui';
import './globals.css';

export const metadata: Metadata = {
  title: 'AEO Toolkit — AI Search Optimization Suite',
  description:
    'Audit, optimize, and track your visibility in AI answer engines (ChatGPT, Claude, Perplexity, AI Overviews) — one console for the whole AEO Toolkit.',
};

/** Top-level tools, surfaced in the console nav. */
const NAV = [
  { href: '/tools/audit', label: 'Audit' },
  { href: '/tools/eeat', label: 'E-E-A-T' },
  { href: '/tools/llms-txt', label: 'llms.txt' },
  { href: '/tools/chat', label: 'GA4 + GSC' },
  { href: '/tools/graph', label: 'Backlink Graph' },
] as const;

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#0b1020]/80 px-6 py-3 backdrop-blur">
          <Link href="/" aria-label="AEO Toolkit home">
            <Logo size={28} variant="dark" />
          </Link>
          <nav className="flex gap-4 text-sm text-slate-300">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
