import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Footer } from '@/components/ui/Footer';
import { Header } from '@/components/Header';
import { JsonLd } from '@/components/seo/JsonLd';
import { organizationSchema, websiteSchema, softwareApplicationSchema, SITE_URL } from '@/lib/seo';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

// SITE_URL is imported from '@/lib/seo' — the single source of truth (falls back to the
// canonical https://aeo.advancelabs.dev). Previously this file redefined it with a divergent
// vercel.app fallback, which would split the canonical/OG host from the sitemap/robots host
// whenever MCP_PUBLIC_URL was unset.

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AEO Toolkit — Rank in ChatGPT, Claude, Perplexity & AI Overviews',
    template: '%s — AEO Toolkit',
  },
  description:
    'Audit, optimize, and track your visibility across AI answer engines. Technical SEO + AEO audits, E-E-A-T scoring, llms.txt generation, GA4/GSC chat, and a 3D backlink graph — one console.',
  applicationName: 'AEO Toolkit',
  keywords: [
    'answer engine optimization',
    'AEO',
    'generative engine optimization',
    'GEO',
    'AI SEO',
    'llms.txt',
    'technical SEO audit',
    'E-E-A-T',
  ],
  openGraph: {
    type: 'website',
    siteName: 'AEO Toolkit',
    title: 'AEO Toolkit — Rank in ChatGPT, Claude, Perplexity & AI Overviews',
    description:
      'One console to audit, optimize, and track your visibility across AI answer engines.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AEO Toolkit — AI Search Optimization Suite',
    description:
      'Audit, optimize, and track your visibility across AI answer engines. One console.',
  },
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="relative min-h-screen overflow-x-hidden bg-ink-950 antialiased">
        <JsonLd data={[organizationSchema(), websiteSchema(), softwareApplicationSchema()]} />
        <AuroraBackground />
        <Header />
        <main className="relative">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
