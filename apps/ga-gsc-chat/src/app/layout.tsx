import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'GA4 + Search Console Chat — AEO Toolkit',
  description:
    'Ask natural-language SEO questions grounded in your own GA4 + Google Search Console data, answered by your own LLM key (BYOK).',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
