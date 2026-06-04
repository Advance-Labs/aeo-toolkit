import type { JSX } from 'react';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  CtaBand,
  Faq,
  FAQS,
  Features,
  Hero,
  HowItWorks,
  ToolsShowcase,
  TrustStrip,
  WhyAeo,
} from '@/components/landing';

/**
 * Marketing landing page for the AEO Toolkit. Server component: every section ships
 * meaningful static HTML (hero copy, tool cards, FAQ) so crawlers and AI bots read the
 * content without JS — only `Reveal` and the FAQ accordion are client islands.
 *
 * The shell layout (`src/app/layout.tsx`) provides the header, footer, aurora backdrop,
 * and the `<main>` wrapper, so this page renders only its section content.
 */

const SITE_URL = process.env.MCP_PUBLIC_URL ?? 'https://aeo-toolkit-ten.vercel.app';

export const metadata: Metadata = {
  title: 'AEO Toolkit — Get cited by ChatGPT, Claude & Perplexity',
  description:
    'Audit, optimize, and track your visibility across AI answer engines. Technical SEO + AEO scoring, E-E-A-T scanning, llms.txt generation, GA4/GSC chat, and a 3D backlink graph — one free console.',
  alternates: { canonical: '/' },
};

/** `SoftwareApplication` schema makes the toolkit eligible for tool/product answers. */
const softwareApplicationLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AEO Toolkit',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'A free console to audit, optimize, and track your visibility across AI answer engines — technical SEO + AEO audits, E-E-A-T scoring, llms.txt generation, GA4/GSC chat, and a 3D backlink graph.',
  url: SITE_URL,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'LLM & Technical SEO Audit',
    'E-E-A-T Scanner',
    'llms.txt Generator',
    'GA4 + Search Console Chat',
    'Backlink Graph',
  ],
};

/** `FAQPage` schema — derived from the same `FAQS` the page renders visibly. */
const faqPageLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};

export default function LandingPage(): JSX.Element {
  return (
    <>
      <JsonLd data={[softwareApplicationLd, faqPageLd]} />
      <Hero />
      <TrustStrip />
      <Features />
      <ToolsShowcase />
      <HowItWorks />
      <WhyAeo />
      <Faq />
      <CtaBand />
    </>
  );
}
