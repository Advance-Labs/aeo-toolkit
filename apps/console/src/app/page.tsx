import type { JSX } from 'react';
import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono, Instrument_Serif, Syne } from 'next/font/google';
import { JsonLd } from '@/components/seo/JsonLd';
import { publicUrl } from '@/lib/seo';
import { Motion } from '@/components/landing-v2/Motion';
import {
  CtaV2,
  FaqV2,
  CinematicStage,
  InstrumentIndexV2,
  LANDING_FAQS,
  LedgerV2,
  StoryFrame,
} from '@/components/landing-v2/Sections';
import '@/components/landing-v2/landing-v2.css';
import { assetUrl } from '@/lib/asset-url';

/**
 * Landing v2 — "the audit, printed." A warm paper report sheet framed in the site's dark
 * graphite shell (light-mode-paper-technical direction). Server components ship the full
 * content statically; Motion.tsx (GSAP + Lenis) and the specimen tilt are the only client
 * islands, both no-ops under prefers-reduced-motion and absent without JavaScript.
 */

const v2Sans = Archivo({ subsets: ['latin'], variable: '--font-v2-sans', display: 'swap' });
const v2Mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-v2-mono',
  display: 'swap',
});
// Display voice: Syne — wide, arty, unmistakably not a default.
const v2Display = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-v2-display',
  display: 'swap',
});
// Cursive accent: Instrument Serif italic, for the one phrase per headline that turns.
const v2Serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  variable: '--font-v2-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AEO Toolkit — Get cited by ChatGPT, Claude & Perplexity',
  description:
    'Audit, optimize, and track your visibility across AI answer engines. Technical SEO + AEO scoring, E-E-A-T scanning, llms.txt generation, GA4/GSC chat, and a 3D backlink graph — one free console.',
  alternates: { canonical: publicUrl('/') },
};

/** Visible FAQ mirrored 1:1 into FAQPage JSON-LD (Organization/WebSite ship from the layout). */
const faqLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: LANDING_FAQS.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: { '@type': 'Answer', text: faq.answer },
  })),
};

export default function LandingPage(): JSX.Element {
  return (
    <div className={`v2 ${v2Sans.variable} ${v2Mono.variable} ${v2Display.variable} ${v2Serif.variable} relative`}>
      {/* The light field the glass refracts — fixed, so it also glows through the chrome. */}
      <div className="v2-backdrop" aria-hidden="true" />
      <JsonLd data={faqLd} />
      <Motion />

      {/* One engineered master shell: gradient-border frame, overshooting rails,
          corner marks. A single container — the earlier two-sheet seam grouped nothing. */}
      <div className="px-6 pt-10 sm:px-8 lg:px-12">
        <div className="v2-frame mx-auto max-w-[88rem]">
          <span className="v2-corner" style={{ top: -2, left: -16 }} aria-hidden="true" />
          <span className="v2-corner" style={{ top: -2, right: -16 }} aria-hidden="true" />
          <span className="v2-corner" style={{ bottom: -2, left: -16 }} aria-hidden="true" />
          <span className="v2-corner" style={{ bottom: -2, right: -16 }} aria-hidden="true" />
          <div className="v2-sheet overflow-hidden">
            <CinematicStage />
            <LedgerV2 />
            <StoryFrame
              src={assetUrl('/story/calibrated.webp')}
              alt="Macro of a precision lens element in matte black metal, a thin green laser refracting through its edge"
              label="Calibrated · 54 rules"
            />
            <InstrumentIndexV2 />
            <FaqV2 />
          </div>
        </div>
      </div>

      {/* Final call sits on the shell itself — the inverse beat that closes the report. */}
      <CtaV2 />
    </div>
  );
}
