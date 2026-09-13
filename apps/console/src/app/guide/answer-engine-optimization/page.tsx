import type { JSX } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Badge,
  Breadcrumb,
  Container,
  GradientText,
  Reveal,
  Section,
  SpotlightCard,
} from '@/components/ui';
import { JsonLd } from '@/components/seo/JsonLd';
import { PUBLIC_ORIGIN, SITE_NAME, breadcrumbSchema, publicUrl } from '@/lib/seo';
import type { Crumb } from '@/lib/seo';

const PAGE_PATH = '/guide/answer-engine-optimization';
const PAGE_TITLE = 'Answer Engine Optimization: The Complete Guide';
const PAGE_DESCRIPTION =
  'What Answer Engine Optimization is, why AI citations are the new rankings, and how to audit and win them — a practical guide with free tools for every step.';

/** Content freshness: bump when the guide's substance changes (feeds dateModified in JSON-LD). */
const DATE_PUBLISHED = '2026-09-02';
const DATE_MODIFIED = '2026-09-02';

const TRAIL: ReadonlyArray<Crumb> = [
  { name: 'Home', path: '/' },
  { name: 'AEO Guide', path: PAGE_PATH },
];

export const metadata: Metadata = {
  title: 'Answer Engine Optimization — The Complete Guide',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: 'article',
    siteName: SITE_NAME,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: publicUrl(PAGE_PATH),
  },
  twitter: { card: 'summary_large_image', title: PAGE_TITLE, description: PAGE_DESCRIPTION },
};

/** Answer-first summary an LLM can lift verbatim. */
const ANSWER_FIRST =
  'Answer Engine Optimization (AEO) is the practice of structuring your website so AI assistants — ChatGPT, Claude, Perplexity, Gemini, and Google AI Overviews — cite it when answering questions in your domain. It works through four layers: letting AI crawlers in, publishing machine-readable structured data, writing answer-first extractable content, and demonstrating trust signals engines can verify. This guide walks through all four, with a free tool for each step.';

/** The four signal layers — each links into the cluster. */
const LAYERS: ReadonlyArray<{
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}> = [
  {
    title: '1 · Access — let the engines in',
    description:
      'AI crawlers (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot) must be allowed by robots.txt, and llms.txt should hand them a curated map of your best pages. A site AI systems cannot read is a site they will never cite — and many sites block them by accident.',
    href: '/glossary/ai-crawler',
    linkLabel: 'What is an AI crawler?',
  },
  {
    title: '2 · Structure — say it machine-readably',
    description:
      'JSON-LD structured data states what your pages assert: Organization and Person for identity, FAQPage and HowTo for pre-extracted answers, Article with dateModified for freshness, one consistent @id everywhere so engines resolve one entity, not several.',
    href: '/glossary/structured-data',
    linkLabel: 'What is structured data?',
  },
  {
    title: '3 · Writing — be quotable',
    description:
      'Answer engines quote what extracts cleanly: a direct 1–2 sentence answer at the top of the page, question-shaped headings, short paragraphs, and lists and tables for facts. Write the snippet you want quoted, then earn it with depth below.',
    href: '/glossary/answer-engine-optimization',
    linkLabel: 'What is AEO?',
  },
  {
    title: '4 · Trust — be safe to cite',
    description:
      'An engine that cites you vouches for you, so it prices the risk: E-E-A-T signals — real bylines, first-hand experience, credentials, citations to primary sources, a resolvable organization — decide whether you clear the bar.',
    href: '/glossary/e-e-a-t',
    linkLabel: 'What is E-E-A-T?',
  },
];

/** The practical how-to — mirrored 1:1 into HowTo JSON-LD. Each step names its tool. */
const STEPS: ReadonlyArray<{ name: string; text: string; href: string; linkLabel: string }> = [
  {
    name: 'Audit where you stand',
    text: 'Run a technical SEO + AEO audit on your site. It crawls your pages and scores crawlability, metadata, structured data, AI-bot access, and answer-readiness, returning a prioritized fix list.',
    href: '/tools/audit',
    linkLabel: 'Run the free audit',
  },
  {
    name: 'Open the gates',
    text: 'Fix robots.txt so the AI crawlers you want citations from are allowed, then generate and publish an llms.txt that maps your most citable pages in your own words.',
    href: '/tools/llms-txt',
    linkLabel: 'Generate your llms.txt',
  },
  {
    name: 'Ship the structured-data backbone',
    text: 'Add Organization and WebSite JSON-LD site-wide, FAQPage and HowTo on answer pages, and Article with author and dateModified on content — keeping every claim consistent with the visible page.',
    href: '/glossary/structured-data',
    linkLabel: 'Structured data, explained',
  },
  {
    name: 'Rewrite key pages answer-first',
    text: 'For each page that targets a question, open with the direct answer an engine could quote verbatim, use question-shaped headings, and move supporting facts into lists and tables.',
    href: '/compare/aeo-vs-seo',
    linkLabel: 'See what changes vs classic SEO',
  },
  {
    name: 'Prove your E-E-A-T',
    text: 'Scan your site’s Experience, Expertise, Authoritativeness, and Trust signals, then close the gaps: bylines with credentials, an about page, contact details, cited sources.',
    href: '/tools/eeat',
    linkLabel: 'Check your E-E-A-T score',
  },
  {
    name: 'Measure citations, not just rankings',
    text: 'Ask the engines your customers’ questions on a schedule and record whether you are cited and where you place among competitors. Watch AI-referral traffic alongside classic Search Console metrics.',
    href: '/tools/chat',
    linkLabel: 'Chat with your GA4 + GSC data',
  },
];

/** Visible FAQ — mirrored 1:1 into FAQPage JSON-LD. */
const FAQ: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: 'How long does AEO take to show results?',
    answer:
      'The technical layer moves fastest: crawl access, llms.txt, and structured data can be shipped in days, and retrieval-time engines like Perplexity pick up changes within their next crawls — often weeks, not months. Content and trust signals compound more slowly, like classic SEO. Measure citation rate per query over time rather than expecting a single flip.',
  },
  {
    question: 'Do I need different content for each answer engine?',
    answer:
      'No. The engines differ in retrieval details but reward the same fundamentals: crawlable pages, verifiable identity, extractable answer-first writing. Optimize once, then verify per engine — the same page that wins a Perplexity citation is well-shaped for ChatGPT search and AI Overviews.',
  },
  {
    question: 'Is AEO worth it if my traffic still comes from Google?',
    answer:
      'The overlap makes it cheap insurance: nearly everything AEO asks for (clean crawlability, structured data, better-shaped content, demonstrated expertise) also strengthens classic rankings today. The AI-specific additions — llms.txt, AI-bot directives — take hours. You are positioning for where discovery is moving without betting against where it is.',
  },
  {
    question: 'Can I do AEO without new tools?',
    answer:
      'You can hand-check robots.txt, write llms.txt yourself, and validate JSON-LD in a validator — AEO is a practice, not a product. Tooling buys you coverage and repetition: an audit that checks every signal on every page, and a scheduled measurement of whether the engines actually cite you. This toolkit is free and open-source precisely so the practice is accessible.',
  },
];

function buildJsonLd(): Record<string, unknown>[] {
  const url = publicUrl(PAGE_PATH);
  return [
    breadcrumbSchema(TRAIL),
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      url,
      datePublished: DATE_PUBLISHED,
      dateModified: DATE_MODIFIED,
      // The canonical Organization node the layout emits — same @id, one corroborated entity.
      author: { '@id': `${PUBLIC_ORIGIN}/#organization` },
      about: ANSWER_FIRST,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How to do Answer Engine Optimization',
      description: 'Six steps from audit to measured AI citations, each with a free tool.',
      step: STEPS.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: step.name,
        text: step.text,
      })),
    },
  ];
}

/**
 * The AEO cornerstone guide (#37): the hub of the topic cluster. Links out to every tool,
 * glossary term, and comparison; they link back. Answer-first, extractable throughout.
 */
export default function AeoGuidePage(): JSX.Element {
  return (
    <>
      <JsonLd data={buildJsonLd()} />

      <Section className="pb-8 pt-12 sm:pt-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
          <header className="flex flex-col gap-5">
            <Breadcrumb trail={TRAIL} />
            <Badge tone="cyan">The complete guide</Badge>
            <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl">
              Answer Engine <GradientText>Optimization</GradientText>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-slate-300">{ANSWER_FIRST}</p>
          </header>
        </div>
      </Section>

      {/* Why it matters */}
      <Section className="border-t border-white/[0.06] py-16 sm:py-20">
        <Container>
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Why citations are the <GradientText>new rankings</GradientText>
            </h2>
            <p className="text-base leading-relaxed text-slate-300">
              When an AI assistant answers a question directly, the searcher never sees a results
              page — they see two or three cited sources and everything else contributes nothing.
              That concentration changes the economics of visibility: classic search distributed
              attention across ten links, while an answer engine hands nearly all of it to the
              sources it chose to trust.
            </p>
            <p className="text-base leading-relaxed text-slate-300">
              The selection is not an ad auction. Engines pick sources they can crawl, parse, and
              defend — which means the levers are entirely on your side of the fence: access,
              structure, writing, and demonstrated trust. If you want the deeper contrast with
              classic search tactics, read{' '}
              <Link
                href="/compare/aeo-vs-seo"
                className="font-medium text-brand-cyan hover:underline"
              >
                AEO vs SEO
              </Link>
              ; the short version is that SEO qualifies you for consideration and AEO wins the
              selection.
            </p>
          </div>
        </Container>
      </Section>

      {/* The four layers */}
      <Section className="border-t border-white/[0.06] bg-grid py-16 sm:py-20">
        <Container>
          <Reveal>
            <div className="flex max-w-2xl flex-col gap-3">
              <span className="eyebrow">The four layers</span>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                What answer engines actually <GradientText>check</GradientText>
              </h2>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {LAYERS.map((layer, i) => (
              <Reveal key={layer.title} delay={(i % 2) * 0.05}>
                <SpotlightCard className="h-full p-6">
                  <h3 className="text-base font-semibold text-white">{layer.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{layer.description}</p>
                  <Link
                    href={layer.href}
                    className="mt-3 inline-block text-sm font-medium text-brand-cyan hover:underline"
                  >
                    {layer.linkLabel} →
                  </Link>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* How to do it */}
      <Section className="border-t border-white/[0.06] py-16 sm:py-20">
        <Container>
          <Reveal>
            <div className="flex max-w-2xl flex-col gap-3">
              <span className="eyebrow">How to do AEO</span>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Six steps, each with a <GradientText>free tool</GradientText>
              </h2>
            </div>
          </Reveal>
          <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.name} delay={(i % 3) * 0.04}>
                <li className="surface flex h-full flex-col gap-3 p-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-bold text-brand-cyan">
                    {i + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-white">{step.name}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{step.text}</p>
                  <Link
                    href={step.href}
                    className="mt-auto text-sm font-medium text-brand-cyan hover:underline"
                  >
                    {step.linkLabel} →
                  </Link>
                </li>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      {/* FAQ */}
      <Section className="border-t border-white/[0.06] py-16 sm:py-20">
        <Container>
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Answer Engine Optimization, asked and answered
            </h2>
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
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.answer}</p>
                </details>
              ))}
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              Want the definitions behind the jargon? Start at the{' '}
              <Link href="/glossary" className="font-medium text-brand-cyan hover:underline">
                AEO glossary
              </Link>
              .
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
