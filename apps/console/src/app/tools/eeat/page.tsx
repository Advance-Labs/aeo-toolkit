import type { JSX, ReactNode } from 'react';
import type { Metadata } from 'next';
import { Badge, Container, GradientText, Reveal, Section, SpotlightCard } from '@/components/ui';
import { JsonLd } from '@/components/seo/JsonLd';
import { EeatScanner } from '@/components/eeat/EeatScanner.js';

const SITE_URL = process.env.MCP_PUBLIC_URL ?? 'https://aeo-toolkit-ten.vercel.app';
const CANONICAL_PATH = '/tools/eeat';
const PAGE_URL = `${SITE_URL}${CANONICAL_PATH}`;

export const metadata: Metadata = {
  title: 'E-E-A-T Scanner — Score Experience, Expertise, Authority & Trust',
  description:
    'Free E-E-A-T checker. Crawl up to 12 pages and score Experience, Expertise, Authoritativeness, and Trust signals that Google and AI answer engines reward. Get a prioritized fix list.',
  alternates: { canonical: CANONICAL_PATH },
  openGraph: {
    type: 'website',
    title: 'E-E-A-T Scanner — Free Experience, Expertise, Authority & Trust Checker',
    description:
      'Scan any URL and score the four E-E-A-T pillars with present/absent signals and a prioritized fix list.',
    url: PAGE_URL,
  },
};

/** The four E-E-A-T pillars, used for the visible explainer. */
const PILLARS: { key: string; label: string; blurb: string; icon: ReactNode; accent: string }[] = [
  {
    key: 'experience',
    label: 'Experience',
    blurb:
      'First-hand, real-world use of what you write about — author bios, original photos, case studies, and “I tested this” signals.',
    accent: 'text-brand-cyan from-brand-cyan/25',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    key: 'expertise',
    label: 'Expertise',
    blurb:
      'Demonstrated knowledge and credentials — named authors with qualifications, depth of coverage, and accurate, current information.',
    accent: 'text-brand-indigo from-brand-indigo/25',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
  },
  {
    key: 'authoritativeness',
    label: 'Authoritativeness',
    blurb:
      'Recognition as a go-to source — citations, external links, brand mentions, and a consistent, well-structured entity across the web.',
    accent: 'text-brand-violet from-brand-violet/25',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    ),
  },
  {
    key: 'trust',
    label: 'Trust',
    blurb:
      'The most important pillar — HTTPS, clear contact and policy pages, accurate content, secure checkout, and transparent ownership.',
    accent: 'text-emerald-400 from-emerald-400/25',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
];

/** How-to steps, rendered as visible content AND HowTo JSON-LD. */
const HOW_TO_STEPS: { name: string; text: string }[] = [
  {
    name: 'Enter your URL',
    text: 'Paste any page or homepage URL into the scanner and start the scan.',
  },
  {
    name: 'Crawl & score',
    text: 'The scanner crawls up to 12 pages and scores each E-E-A-T pillar from 0–100 based on the signals it finds.',
  },
  {
    name: 'Review pillar signals',
    text: 'Open each pillar card to see which trust signals are present, which are absent, and the evidence behind the score.',
  },
  {
    name: 'Apply the fixes',
    text: 'Work through the prioritized improvements list — heaviest-weight gaps first — then re-scan to confirm the lift.',
  },
];

/** FAQ entries, rendered as visible content AND FAQPage JSON-LD. */
const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is E-E-A-T?',
    a: 'E-E-A-T stands for Experience, Expertise, Authoritativeness, and Trust. It is the framework Google’s quality raters — and increasingly AI answer engines like ChatGPT, Perplexity, and Google AI Overviews — use to judge whether content is reliable enough to surface and cite.',
  },
  {
    q: 'What is a good E-E-A-T score?',
    a: 'A score of 80 or above (grade A) means most trust signals are present and your content is well positioned to be cited. 50–79 (B–C) is a solid foundation with clear gaps to close. Below 50 (D–F) means critical signals like author identity, HTTPS, or policy pages are missing and should be fixed first.',
  },
  {
    q: 'How do I improve my E-E-A-T?',
    a: 'Add named authors with real credentials and bios, cite and link to authoritative sources, publish clear contact and policy pages, keep content accurate and dated, serve everything over HTTPS, and show first-hand experience with original photos, data, or case studies. The scanner’s prioritized fix list tells you exactly which gaps to close first.',
  },
  {
    q: 'Does E-E-A-T affect AI search and answer engines?',
    a: 'Yes. Answer engines cite sources they can trust. The same E-E-A-T signals that help you rank in Google — clear authorship, citations, accuracy, and a trustworthy site — make a page more likely to be quoted inside ChatGPT, Claude, Perplexity, and AI Overviews.',
  },
  {
    q: 'Is the E-E-A-T Scanner free?',
    a: 'Yes. The E-E-A-T Scanner is free to use. Paste a URL, crawl up to 12 pages, and get an instant pillar-by-pillar score with a prioritized fix list — no signup required.',
  },
];

/**
 * E-E-A-T Scanner tool page. The global layout supplies `<main>`, Header, Footer,
 * and the aurora backdrop — this page renders only its content: an answer-first
 * hero, the interactive scanner island, an explainer, a FAQ, and matching
 * structured data (WebPage + BreadcrumbList + HowTo + FAQPage).
 */
export default function EeatToolPage(): JSX.Element {
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE_URL}/tools` },
      { '@type': 'ListItem', position: 3, name: 'E-E-A-T Scanner', item: PAGE_URL },
    ],
  };

  const webPageLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'E-E-A-T Scanner',
    url: PAGE_URL,
    description:
      'Free E-E-A-T checker that scores Experience, Expertise, Authoritativeness, and Trust signals for any URL.',
    isPartOf: { '@type': 'WebSite', name: 'AEO Toolkit', url: SITE_URL },
  };

  const howToLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to run an E-E-A-T scan',
    description:
      'Scan any URL to score its Experience, Expertise, Authoritativeness, and Trust signals and get a prioritized fix list.',
    step: HOW_TO_STEPS.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.name,
      text: step.text,
    })),
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  };

  return (
    <>
      <JsonLd data={[breadcrumbLd, webPageLd, howToLd, faqLd]} />

      {/* Hero + scanner */}
      <Section className="pt-16 sm:pt-20">
        <Container>
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 text-center">
            <Reveal>
              <Badge tone="violet">E-E-A-T Scanner</Badge>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="text-balance text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Score your <GradientText>Experience, Expertise, Authority &amp; Trust</GradientText>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="max-w-2xl text-balance text-base leading-relaxed text-slate-400 sm:text-lg">
                The E-E-A-T Scanner crawls up to 12 pages and grades the four trust signals Google
                and AI answer engines use to decide what to cite. Paste a URL to get a
                pillar-by-pillar score and a prioritized list of fixes.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.15} className="mx-auto mt-10 w-full max-w-3xl">
            <EeatScanner />
          </Reveal>
        </Container>
      </Section>

      {/* What E-E-A-T means */}
      <Section className="pt-0">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">The framework</span>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
              What E-E-A-T means
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              E-E-A-T is the four-part trust framework Google’s quality guidelines — and modern
              answer engines — use to judge content. The scanner checks concrete signals for each
              pillar.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PILLARS.map((pillar, i) => (
              <Reveal key={pillar.key} delay={i * 0.05}>
                <SpotlightCard className="h-full">
                  <article className="flex h-full flex-col gap-4 p-6">
                    <span
                      aria-hidden="true"
                      className={`flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br to-transparent ${pillar.accent}`}
                    >
                      {pillar.icon}
                    </span>
                    <h3 className="text-lg font-semibold text-white">{pillar.label}</h3>
                    <p className="text-sm leading-relaxed text-slate-400">{pillar.blurb}</p>
                  </article>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* How it works */}
      <Section className="pt-0">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">How it works</span>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
              Run a scan in four steps
            </h2>
          </div>

          <ol className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_TO_STEPS.map((step, i) => (
              <Reveal key={step.name} delay={i * 0.05}>
                <li className="surface flex h-full flex-col gap-3 p-6">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm font-semibold tabular-nums text-brand-cyan">
                    {i + 1}
                  </span>
                  <h3 className="text-base font-semibold text-white">{step.name}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{step.text}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      {/* FAQ */}
      <Section className="pt-0">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">FAQ</span>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
              E-E-A-T questions, answered
            </h2>
          </div>

          <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-3">
            {FAQS.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 0.04}>
                <details className="group surface px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                    <h3 className="text-base font-medium text-white">{faq.q}</h3>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-45"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{faq.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
