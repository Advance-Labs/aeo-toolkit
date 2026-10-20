import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { Footer } from '@/components/ui/Footer';
import { Header } from '@/components/Header';
import { JsonLd } from '@/components/seo/JsonLd';
import { organizationSchema, websiteSchema, softwareApplicationSchema, SITE_URL } from '@/lib/seo';
import './globals.css';

// Build from checked package assets so CI does not depend on Google Fonts responses.
const sans = localFont({
  src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-sans',
  display: 'swap',
});
const display = localFont({
  src: '../../node_modules/@fontsource-variable/syne/files/syne-latin-wght-normal.woff2',
  weight: '400 800',
  variable: '--font-display',
  display: 'swap',
});
const mono = localFont({
  src: '../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  weight: '100 800',
  variable: '--font-mono',
  display: 'swap',
});
// v2 identity face — the wordmark and landing headlines share it.
const brand = localFont({
  src: '../../node_modules/@fontsource-variable/syne/files/syne-latin-wght-normal.woff2',
  weight: '400 800',
  variable: '--font-brand',
  display: 'swap',
});

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
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable} ${brand.variable}`}
    >
      {/* Instrument ground, shared by chrome, sheets and tool pages. #101010 `paper`; cards
          recede to #080808 `card`, so depth comes from a rule rather than a glow. */}
      <body className="relative min-h-screen overflow-x-hidden bg-paper antialiased">
        <JsonLd data={[organizationSchema(), websiteSchema(), softwareApplicationSchema()]} />
        <Header />
        <main className="relative">{children}</main>
        <Footer />
        {/* Core Web Vitals field data (SEO-AEO-PLAN §7) plus page-view analytics. Both
            no-op outside Vercel — the scripts only load when the deployment provides
            them — so self-hosted/Docker installs are unaffected and no data leaves them. */}
        <SpeedInsights />
        <Analytics />
        {/* Third tracker, and the only one that is OUR property rather than the platform's.
            Gated on NEXT_PUBLIC_GA_MEASUREMENT_ID so self-hosted installs stay silent. */}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
