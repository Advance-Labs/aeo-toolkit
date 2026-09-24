import type { JSX } from 'react';
import { Badge, Breadcrumb, Container, Reveal, SectionHeading } from '@/components/ui';
import { JsonLd } from '@/components/seo/JsonLd';
import { SITE_URL, breadcrumbSchema, toolBreadcrumbTrail, toolMetadata } from '@/lib/seo';
import { FaqSection } from '@/components/llms-txt/FaqSection.js';
import { AuthorityView } from '@/components/authority/AuthorityView';
import {
  FAQ_ITEMS,
  GRAPH_DOMAINS,
  GRAPH_EDGES,
  HOW_TO_STEPS,
} from '@/components/authority/content';

/**
 * /tools/authority — the Website Authority Checker.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS PAGE IS SHAPED LIKE A COMPETITOR'S
 * ─────────────────────────────────────────────────────────────────────────────
 * The section order here (hero + tool → explainer → HowTo → FAQ → related tools)
 * is the same information architecture every free-tool page in this category uses,
 * and it is the same one the sibling tool pages already use. That is not imitation
 * for its own sake: the tool answers a transactional query, and the prose beneath
 * it answers the informational queries that surround it, so one URL can rank for
 * "domain authority checker" and be cited for "what is a domain authority score".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE POSITION THIS PAGE TAKES. DO NOT SOFTEN IT.
 * ─────────────────────────────────────────────────────────────────────────────
 * Every incumbent free authority checker reports a proprietary score from a private
 * index. This one reports Open PageRank over Common Crawl's public domain graph, and
 * says plainly that it is neither Moz DA nor Ahrefs DR and cannot be. The candour IS
 * the differentiator, and it is also the only defensible claim we can make, because
 * we do not own a private crawl.
 *
 * So: never relabel this number as "Domain Authority", never normalize it to 0–100
 * to look more familiar without saying that is what happened, and never render a
 * fallback figure when the lookup fails. `AuthorityView` degrades to a sentence, not
 * a zero, and that is load-bearing.
 */

const PAGE_PATH = '/tools/authority';
const PAGE_URL = `${SITE_URL.replace(/\/$/, '')}${PAGE_PATH}`;
const PAGE_TITLE = 'Website Authority Checker';
const PAGE_DESCRIPTION =
  'Check any domain’s authority score free, computed over Common Crawl’s public link graph. Get Open PageRank 0–10, global rank, referring domains, and monthly history back to 2018.';
const TRAIL = toolBreadcrumbTrail(PAGE_TITLE, PAGE_PATH);

export const metadata = toolMetadata({
  path: PAGE_PATH,
  // 57 characters.
  title: 'Website Authority Checker — Free Domain Authority',
  description: PAGE_DESCRIPTION,
  shareTitle: 'Website Authority Checker — an open alternative to DA and DR',
  shareDescription:
    'Open PageRank 0–10 over Common Crawl’s public link graph, with monthly history back to 2018. Free, no account, and honest about what the number is not.',
});

/** schema.org JSON-LD: breadcrumb trail, the FAQ Q&A pairs, and the HowTo steps. */
function structuredData(): Record<string, unknown>[] {
  const breadcrumb = breadcrumbSchema(TRAIL);

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
    name: 'How to check a website’s authority score for free',
    description:
      'Check the authority of any domain against the public Common Crawl link graph in four steps, using the free AEO Toolkit authority checker.',
    totalTime: 'PT1M',
    tool: [{ '@type': 'HowToTool', name: 'AEO Toolkit Website Authority Checker' }],
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

/** The three things a reader most needs to know before trusting the number. */
const EXPLAINER_CARDS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'A public graph, not a private one',
    body: `Open PageRank runs the original PageRank algorithm over Common Crawl’s domain-level web graph — about ${GRAPH_DOMAINS} domains joined by ${GRAPH_EDGES} links, released as open data. You can download the same graph and check the arithmetic.`,
  },
  {
    title: 'Not Domain Authority, not Domain Rating',
    body: 'Those are proprietary metrics over private crawls, licensed per call. No free tool can compute them. This is a different number measuring a similar idea, and conflating the two would make every comparison you draw wrong.',
  },
  {
    title: 'A relative measure with a monthly clock',
    body: 'The graph rebuilds monthly and the scale is roughly logarithmic, so read your position against direct competitors and read the trend. An established domain carries a monthly series back to 2018; a single absolute score, on its own, decides nothing.',
  },
];

/** Internal links, chosen so each one answers the question this page raises next. */
const RELATED: ReadonlyArray<{ href: string; title: string; body: string }> = [
  {
    href: '/tools/graph',
    title: 'Backlink Graph',
    body: 'See the actual links behind the score, sampled live from the same open indexes.',
  },
  {
    href: '/tools/audit',
    title: 'Technical SEO + AEO Audit',
    body: 'Links are one input. Score crawlability, structure, and answer-readiness too.',
  },
  {
    href: '/tools/eeat',
    title: 'E-E-A-T Scanner',
    body: 'Authority as an answer engine reads it: experience, expertise, and trust signals.',
  },
];

export default function AuthorityToolPage(): JSX.Element {
  return (
    <>
      <JsonLd data={structuredData()} />

      <Container className="py-12 sm:py-16 lg:py-20">
        <div className="flex flex-col gap-16 lg:gap-24">
          {/* Hero + checker */}
          <section className="flex flex-col gap-8">
            <Breadcrumb trail={TRAIL} />

            <Reveal className="flex max-w-2xl flex-col gap-5">
              <Badge tone="cyan">Open link graph · Free Tool</Badge>
              <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
                Website Authority Checker
              </h1>
              {/* Answer-first: the definition an engine can lift sits in the first sentence. */}
              <p className="text-balance text-lg leading-relaxed text-slate-300">
                A website’s authority score estimates how much link equity its domain has earned.
                Enter any domain to get its{' '}
                <span className="font-medium text-white">Open PageRank</span>, a 0–10 score computed
                over Common Crawl’s public link graph, plus its global rank, referring domains, and
                every monthly observation back to 2018. Free, no account — and it is not Moz DA or
                Ahrefs DR,
                which is explained below.
              </p>
            </Reveal>

            <Reveal delay={0.05}>
              <AuthorityView />
            </Reveal>
          </section>

          {/* What the number is */}
          <section aria-labelledby="explainer-heading" className="flex flex-col gap-8">
            <SectionHeading
              align="left"
              eyebrow="The basics"
              title="What this number"
              gradient="actually is"
              subtitle="Three things worth knowing before you act on any authority score, ours included."
              className="max-w-2xl"
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {EXPLAINER_CARDS.map((card) => (
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
              title="From domain to"
              gradient="a number you can use"
              subtitle="Four steps, about a minute — no account required."
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
              Keep measuring
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {RELATED.map((tool) => (
                <a
                  key={tool.href}
                  href={tool.href}
                  className="surface group flex flex-col gap-1.5 p-5 transition-colors hover:border-white/20"
                >
                  <span className="text-base font-semibold text-white">{tool.title}</span>
                  <span className="text-sm leading-relaxed text-slate-400">{tool.body}</span>
                </a>
              ))}
            </div>
          </section>
        </div>
      </Container>
    </>
  );
}
