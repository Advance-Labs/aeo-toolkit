import type { Metadata } from 'next';
import type { JSX, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'E-E-A-T Scanner',
  description:
    'Scan a website and score the four E-E-A-T pillars — Experience, Expertise, Authoritativeness, and Trust — across up to 12 crawled pages.',
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
