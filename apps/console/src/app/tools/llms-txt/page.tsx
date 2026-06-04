import type { JSX } from 'react';
import type { Metadata } from 'next';
import { Badge, Button, Container, GradientText, Reveal, SectionHeading } from '@/components/ui';
import { JsonLd } from '@/components/seo/JsonLd';
import { SITE_NAME, SITE_URL } from '@/lib/seo';
import { GeneratorView } from '@/components/llms-txt/GeneratorView.js';
import { FaqSection } from '@/components/llms-txt/FaqSection.js';
import { FAQ_ITEMS, HOW_TO_STEPS } from '@/components/llms-txt/content.js';

const PAGE_PATH = '/tools/llms-txt';
const PAGE_URL = `${SITE_URL.replace(/\/$/, '')}${PAGE_PATH}`;
const PAGE_TITLE = 'llms.txt Generator';
const PAGE_DESCRIPTION =
  'Generate a structured llms.txt for any website. Crawl your pages, extract titles and descriptions, and ship a curated AI crawl map so ChatGPT, Claude, and Perplexity can find and cite your content. Free.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: `${PAGE_TITLE} — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    type: 'website',
  },
};

/** schema.org JSON-LD: breadcrumb trail, the FAQ Q&A pairs, and the HowTo steps. */
function structuredData(): Record<string, unknown>[] {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL.replace(/\/$/, '') },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Tools',
        item: `${SITE_URL.replace(/\/$/, '')}/#tools`,
      },
      { '@type': 'ListItem', position: 3, name: PAGE_TITLE, item: PAGE_URL },
    ],
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to generate an llms.txt file for your website',
    description:
      'Generate a structured llms.txt that maps your site for AI crawlers in four steps using the free AEO Toolkit generator.',
    totalTime: 'PT2M',
    tool: [{ '@type': 'HowToTool', name: 'AEO Toolkit llms.txt Generator' }],
    step: HOW_TO_STEPS.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.name,
      text: step.text,
      url: `${PAGE_URL}#how-it-works`,
    })),
  };

  return [breadcrumb, faqPage, howTo];
}

/**
 * llms.txt Generator tool page. Server-rendered shell (hero, explainer, HowTo, FAQ,
 * structured data) wrapping the interactive {@link GeneratorView} island. The global
 * layout supplies `<main>`, the aurora backdrop, header, and footer.
 */
export default function LlmsTxtToolPage(): JSX.Element {
  return (
    <>
      <JsonLd data={structuredData()} />

      <Container className="py-12 sm:py-16 lg:py-20">
        <div className="flex flex-col gap-16 lg:gap-24">
          {/* Hero + generator */}
          <section className="flex flex-col gap-8">
            <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
              <ol className="flex flex-wrap items-center gap-1.5">
                <li>
                  <a href="/" className="transition hover:text-slate-300">
                    Home
                  </a>
                </li>
                <li aria-hidden>/</li>
                <li>
                  <a href="/#tools" className="transition hover:text-slate-300">
                    Tools
                  </a>
                </li>
                <li aria-hidden>/</li>
                <li className="text-slate-300">llms.txt Generator</li>
              </ol>
            </nav>

            <Reveal className="flex max-w-2xl flex-col gap-5">
              <Badge tone="cyan">AI Crawl Map · Free Tool</Badge>
              <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
                llms.txt <GradientText>Generator</GradientText>
              </h1>
              <p className="text-balance text-lg leading-relaxed text-slate-300">
                <span className="font-medium text-white">llms.txt</span> is a plain-text file you
                publish at the root of your domain that hands AI crawlers a clean, curated map of
                your best content — a sitemap for answer engines. Paste a URL below and generate a
                ready-to-ship{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.9em] text-brand-cyan">
                  llms.txt
                </code>{' '}
                so ChatGPT, Claude, Perplexity, and AI Overviews can find and cite your pages.
              </p>
            </Reveal>

            <Reveal delay={0.05}>
              <GeneratorView />
            </Reveal>
          </section>

          {/* What is llms.txt? explainer */}
          <section aria-labelledby="explainer-heading" className="flex flex-col gap-8">
            <SectionHeading
              align="left"
              eyebrow="The basics"
              title="What is"
              gradient="llms.txt?"
              subtitle="A short, link-first index of your site that LLMs can read in one fetch — so they cite the right pages instead of guessing from raw HTML."
              className="max-w-2xl"
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: 'A map, not a wall of text',
                  body: 'It lists your key URLs under clear headings with one-line summaries — the table of contents an LLM uses to navigate your site.',
                },
                {
                  title: 'Lives at the root',
                  body: 'Published at /llms.txt, it is the de-facto convention (per llmstxt.org) that AI crawlers look for, just like robots.txt and sitemap.xml.',
                },
                {
                  title: 'Built for context budgets',
                  body: 'Models have limited context. A curated file surfaces canonical, high-value pages first, improving the odds your content is quoted accurately.',
                },
              ].map((card) => (
                <div key={card.title} className="surface flex flex-col gap-2 p-5">
                  <h3 className="text-base font-semibold text-white">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{card.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section id="how-it-works" aria-labelledby="how-heading" className="flex flex-col gap-8">
            <SectionHeading
              align="left"
              eyebrow="How it works"
              title="From URL to"
              gradient="published file"
              subtitle="Four steps, about two minutes — no account required."
              className="max-w-2xl"
            />
            <ol className="grid gap-4 sm:grid-cols-2">
              {HOW_TO_STEPS.map((step, i) => (
                <li key={step.name} className="surface flex gap-4 p-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 font-mono text-sm font-semibold text-brand-cyan">
                    {i + 1}
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold text-white">{step.name}</h3>
                    <p className="text-sm leading-relaxed text-slate-400">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* FAQ */}
          <section aria-labelledby="faq-heading" className="flex flex-col gap-8">
            <SectionHeading
              align="left"
              eyebrow="FAQ"
              title="Common"
              gradient="questions"
              className="max-w-2xl"
            />
            <FaqSection items={FAQ_ITEMS} />
          </section>

          {/* Related tools / internal linking */}
          <section aria-labelledby="related-heading" className="flex flex-col gap-6">
            <h2 id="related-heading" className="text-xl font-semibold text-white">
              Keep optimizing for AI search
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  href: '/tools/audit',
                  title: 'Technical SEO + AEO Audit',
                  body: 'Score crawlability, structure, and answer-readiness in one pass.',
                },
                {
                  href: '/tools/eeat',
                  title: 'E-E-A-T Scanner',
                  body: 'Grade Experience, Expertise, Authoritativeness, and Trust signals.',
                },
                {
                  href: '/tools/graph',
                  title: 'Backlink Graph',
                  body: 'Visualize your link neighborhood in an interactive 3D graph.',
                },
              ].map((tool) => (
                <a
                  key={tool.href}
                  href={tool.href}
                  className="surface group flex flex-col gap-1.5 p-5 transition-colors hover:border-white/20"
                >
                  <span className="flex items-center gap-1.5 text-base font-semibold text-white">
                    {tool.title}
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-cyan"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path
                        d="M5 12h14m-6-6 6 6-6 6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="text-sm leading-relaxed text-slate-400">{tool.body}</span>
                </a>
              ))}
            </div>
            <div>
              <Button href="/#tools" variant="secondary" size="md">
                Browse all tools
              </Button>
            </div>
          </section>
        </div>
      </Container>
    </>
  );
}
