import type { Metadata } from 'next';
import type { JSX, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'llms.txt Generator — AEO Toolkit',
  description:
    'Crawl any site and generate a structured llms.txt (and optional llms-full.txt) per the llmstxt.org spec.',
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
