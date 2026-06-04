import type { JSX } from 'react';
import type { Metadata } from 'next';
import { Badge, Container, GradientText, Reveal, Section, SpotlightCard } from '@/components/ui';
import { JsonLd } from '@/components/seo/JsonLd';
import { AuditExperience } from '@/components/audit/AuditExperience';

const SITE_URL = process.env.MCP_PUBLIC_URL ?? 'https://aeo-toolkit-ten.vercel.app';
const PAGE_PATH = '/tools/audit';
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;

export const metadata: Metadata = {
  title: 'LLM & Technical SEO Audit',
  description:
    'Run a free LLM & technical SEO audit: crawl up to 50 pages, score crawlability, metadata, structured data, and answer-engine readiness out of 100, and get a prioritized fix list.',
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: 'LLM & Technical SEO Audit — AEO Toolkit',
    description:
      'Crawl, score, and fix your site for both classic SEO and AI answer engines. Free, no sign-up.',
    url: PAGE_URL,
    type: 'website',
  },
};

/** Answer-first summary an LLM can lift verbatim. Kept in one place for reuse in copy + JSON-LD. */
const ANSWER_FIRST =
  'An LLM & technical SEO audit crawls your website, checks the technical and answer-engine signals that determine whether Google and AI assistants can find, understand, and cite your pages, and scores the result out of 100. The AEO Toolkit audit crawls up to 50 pages and returns an overall grade, a category breakdown, a prioritized fix list, and ready-to-use templates for any missing crawl-hint files.';

/** Signal groups the audit evaluates — drives the visible feature list and reads as extractable content. */
const CHECKS: ReadonlyArray<{ title: string; description: string }> = [
  {
    title: 'Crawlability & indexing',
    description:
      'robots.txt rules, sitemap presence and validity, canonical tags, noindex/nofollow directives, and broken links that block discovery.',
  },
  {
    title: 'Metadata & on-page',
    description:
      'Title tags, meta descriptions, a single descriptive H1, heading hierarchy, and image alt text that search and answer engines parse.',
  },
  {
    title: 'Structured data (JSON-LD)',
    description:
      'schema.org markup such as Organization, Article, FAQPage, and BreadcrumbList — the machine-readable layer AI engines cite from.',
  },
  {
    title: 'Answer-engine readiness (AEO)',
    description:
      'llms.txt presence, AI-bot directives (GPTBot, ClaudeBot, PerplexityBot), answer-first content structure, and extractable Q&A formatting.',
  },
  {
    title: 'Mobile & Core Web Vitals',
    description:
      'Responsive viewport, tap-target sizing, and the performance signals that gate both rankings and a good crawl experience.',
  },
  {
    title: 'Security & social',
    description:
      'HTTPS enforcement and Open Graph / Twitter card tags so links render richly when shared and cited.',
  },
];

/** Visible FAQ — mirrored 1:1 into FAQPage JSON-LD below. */
const FAQ: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: 'What is a technical SEO audit?',
    answer:
      'A technical SEO audit is an automated check of the back-end signals — crawlability, indexing, metadata, structured data, mobile, and security — that determine whether search engines and AI assistants can access, understand, and rank your pages. It surfaces the issues a manual review would miss and ranks them by impact.',
  },
  {
    question: 'How long does the audit take?',
    answer:
      'Most sites finish in under a minute. The audit crawls up to 50 pages; larger or slower sites take a little longer because each page is fetched and scored individually. The report renders in your browser as soon as the crawl completes.',
  },
  {
    question: 'What is a good audit score?',
    answer:
      'Scores map to letter grades: 90+ is an A, 80–89 a B, 70–79 a C, 60–69 a D, and below 60 an F. Aim for 80+ with zero critical issues. Critical findings (a blocked sitemap, a missing robots.txt, no HTTPS) should be fixed first because they cap everything downstream.',
  },
  {
    question: 'Does this audit cover AI answer engines, not just Google?',
    answer:
      'Yes. Alongside classic technical SEO it scores answer-engine optimization (AEO): whether you ship an llms.txt file, allow AI crawlers like GPTBot and ClaudeBot, structure content as extractable answers, and expose JSON-LD. These are the signals that get you cited inside ChatGPT, Claude, Perplexity, and Google AI Overviews.',
  },
  {
    question: 'Can I export the report?',
    answer:
      'Yes. Every completed audit can be downloaded as a PDF for sharing or archiving, and any missing crawl-hint files (robots.txt, llms.txt, sitemap.xml) are generated as ready-to-use templates you can download and drop into your site root.',
  },
];

/** Numbered steps — mirrored into HowTo JSON-LD. */
const HOW_TO_STEPS: ReadonlyArray<{ name: string; text: string }> = [
  {
    name: 'Enter your URL',
    text: 'Type your website address into the audit field and select Run audit. No sign-up is required.',
  },
  {
    name: 'Let the crawler run',
    text: 'The tool crawls up to 50 pages, fetching and parsing each one to evaluate technical SEO and answer-engine signals.',
  },
  {
    name: 'Review your score and grade',
    text: 'Read your overall 0–100 score and letter grade, then drill into the per-category breakdown to see where you stand.',
  },
  {
    name: 'Work the prioritized fix list',
    text: 'Address findings top-down, starting with critical and high-severity issues, using the recommendation attached to each one.',
  },
  {
    name: 'Download templates and export',
    text: 'Download generated robots.txt, llms.txt, and sitemap templates for anything missing, then export the full report as a PDF.',
  },
];

function buildJsonLd(): Record<string, unknown>[] {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE_URL}/tools` },
      { '@type': 'ListItem', position: 3, name: 'LLM & Technical SEO Audit', item: PAGE_URL },
    ],
  };

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'LLM & Technical SEO Audit',
    description:
      'Run a free LLM & technical SEO audit: crawl up to 50 pages, score crawlability, metadata, structured data, and answer-engine readiness out of 100, and get a prioritized fix list.',
    url: PAGE_URL,
    isPartOf: { '@type': 'WebSite', name: 'AEO Toolkit', url: SITE_URL },
    about: ANSWER_FIRST,
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to run a technical SEO audit',
    description:
      'Run a free technical SEO and answer-engine audit on any website in five steps, then fix the prioritized issues.',
    totalTime: 'PT2M',
    step: HOW_TO_STEPS.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };

  return [breadcrumb, webPage, faqPage, howTo];
}

/**
 * LLM & Technical SEO Audit tool page. Server component: ships answer-first copy, a
 * visible FAQ, and structured data for SEO/AEO, and mounts the interactive
 * {@link AuditExperience} island (which owns the preserved audit + PDF API flow).
 */
export default function AuditToolPage(): JSX.Element {
  return (
    <>
      <JsonLd data={buildJsonLd()} />

      <Section className="pb-8 pt-12 sm:pt-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
          {/* Hero */}
          <header className="flex flex-col gap-5">
            <Badge tone="cyan">Free audit · no sign-up</Badge>
            <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl">
              LLM &amp; Technical <GradientText>SEO Audit</GradientText>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-slate-300">{ANSWER_FIRST}</p>
          </header>

          {/* Interactive island: input row, states, and results. */}
          <AuditExperience />
        </div>
      </Section>

      {/* What the audit checks */}
      <Section className="border-t border-white/[0.06] bg-grid py-16 sm:py-20">
        <Container>
          <Reveal>
            <div className="flex max-w-2xl flex-col gap-3">
              <span className="eyebrow">What the audit checks</span>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Every signal that decides if you get <GradientText>found and cited</GradientText>
              </h2>
              <p className="text-base leading-relaxed text-slate-400">
                The audit evaluates dozens of rules across six signal groups — the same checks that
                separate pages ranked by Google and cited by AI assistants from those that never
                surface.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CHECKS.map((check, i) => (
              <Reveal key={check.title} delay={(i % 3) * 0.05}>
                <SpotlightCard className="h-full p-6">
                  <h3 className="text-base font-semibold text-white">{check.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{check.description}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* How it works */}
      <Section className="border-t border-white/[0.06] py-16 sm:py-20">
        <Container>
          <Reveal>
            <div className="flex max-w-2xl flex-col gap-3">
              <span className="eyebrow">How to run a technical SEO audit</span>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                From URL to fix list in <GradientText>five steps</GradientText>
              </h2>
            </div>
          </Reveal>

          <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {HOW_TO_STEPS.map((step, i) => (
              <Reveal key={step.name} delay={(i % 5) * 0.04}>
                <li className="surface flex h-full flex-col gap-3 p-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-bold text-brand-cyan">
                    {i + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-white">{step.name}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{step.text}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      {/* FAQ */}
      <Section className="border-t border-white/[0.06] py-16 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr,1.5fr]">
            <Reveal>
              <div className="flex flex-col gap-3 lg:sticky lg:top-24">
                <span className="eyebrow">FAQ</span>
                <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Audit <GradientText>questions</GradientText>
                </h2>
                <p className="text-base leading-relaxed text-slate-400">
                  Everything you need to know about scoring, coverage, and what the audit checks for
                  both search and AI answer engines.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.05}>
              <div className="flex flex-col gap-3">
                {FAQ.map((item) => (
                  <details
                    key={item.question}
                    className="surface group p-5 [&_summary::-webkit-details-marker]:hidden"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-white">
                      {item.question}
                      <span
                        aria-hidden
                        className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-45"
                      >
                        <PlusIcon />
                      </span>
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.answer}</p>
                  </details>
                ))}
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>
    </>
  );
}

function PlusIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
