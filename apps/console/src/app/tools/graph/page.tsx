import type { JSX } from 'react';
import { Badge, Breadcrumb, Container, GradientText, Reveal, SpotlightCard } from '@/components/ui';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbSchema, toolBreadcrumbTrail, toolMetadata } from '@/lib/seo';
import { GraphExplorer } from '@/components/graph/GraphExplorer.js';

/**
 * Backlink Graph — the single-page 3D explorer. Re-homed from the standalone
 * `backlink-graph` app into the console route segment.
 *
 * This is a static server component so it can export `metadata` and server-render
 * the answer-first hero, the "sampled, not complete" note, the FAQ block, and the
 * FAQPage / HowTo / BreadcrumbList JSON-LD the AEO plan requires. The interactive
 * WebGL flow (UrlBar → stream → canvas → side rail) lives in the
 * {@link GraphExplorer} client island so the heavy three.js bundle stays
 * browser-only (`dynamic`, `ssr:false`). The shell layout supplies the page
 * `<main>`, so this renders its content inside a plain wrapper (no nested `<main>`).
 */

const SITE_URL = process.env.MCP_PUBLIC_URL ?? 'https://aeo-toolkit-ten.vercel.app';
const PATH = '/tools/graph';
const PAGE_TITLE = 'Backlink Graph';
const TRAIL = toolBreadcrumbTrail(PAGE_TITLE, PATH);

export const metadata = toolMetadata({
  path: PATH,
  title: 'Backlink Graph — Visualize Your Backlink Universe in 3D',
  description:
    'Map any site’s referring domains, backlink pages, and brand mentions in an interactive 3D graph — sourced from open web indexes. Free and directional.',
  shareTitle: 'Backlink Graph — Visualize Your Backlink Universe in 3D',
  shareDescription:
    'Map referring domains, backlink pages, and brand mentions in an interactive 3D graph — sourced from open web indexes.',
});

interface Faq {
  readonly q: string;
  readonly a: string;
}

const FAQS: readonly Faq[] = [
  {
    q: 'What is the Backlink Graph and what does it show?',
    a: 'The Backlink Graph is a free 3D explorer that maps the links pointing to a site. Each node is a referring domain, backlink page, brand mention, or competitor, and each edge is a link — dofollow links pulse brighter than nofollow. It gives you a directional picture of your link profile and which sources carry the most authority.',
  },
  {
    q: 'Where does the backlink data come from?',
    a: 'Backlinks are discovered from open web indexes — DuckDuckGo, CommonCrawl, and the Wayback Machine — not from a paid crawler. That means it is free and privacy-friendly, but it is a sample of the open web rather than a complete commercial index like Ahrefs or Semrush.',
  },
  {
    q: 'Is this a complete backlink index?',
    a: 'No. The Backlink Graph is sampled from open indexes, so treat it as directional rather than exhaustive. Use it to spot patterns — your strongest referring domains, dofollow vs nofollow balance, and competitor overlap — not to report an exact total link count.',
  },
  {
    q: 'How do I explore deeper into the graph?',
    a: 'Click any node to open its detail panel, then choose “Expand backlinks” to fetch and merge that node’s own backlinks into the scene. The graph grows progressively, so you can follow a chain of authority outward from your root domain.',
  },
  {
    q: 'What do dofollow and nofollow links mean here?',
    a: 'Dofollow links pass ranking signals (link equity) and are drawn brighter with more particles; nofollow links are rendered faint. Toggle “Dofollow links only” in the filters to focus on the links most likely to influence search and answer-engine visibility.',
  },
];

const HOW_TO_STEPS: ReadonlyArray<{ name: string; text: string }> = [
  {
    name: 'Enter a URL',
    text: 'Type any domain or URL into the search bar above the scene and select “Build graph”.',
  },
  {
    name: 'Watch the graph grow',
    text: 'Backlinks stream in from open indexes and merge into the 3D scene in real time as they are discovered.',
  },
  {
    name: 'Inspect a node',
    text: 'Click any node to see its type, authority, link equity, and source in the detail panel.',
  },
  {
    name: 'Expand and filter',
    text: 'Use “Expand backlinks” to grow the graph outward, and the filters to focus on dofollow links, specific node types, or a minimum authority.',
  },
];

export default function GraphToolPage(): JSX.Element {
  const breadcrumb = breadcrumbSchema(TRAIL);

  const webPage: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Backlink Graph — Visualize Your Backlink Universe in 3D',
    description: metadata.description ?? undefined,
    url: `${SITE_URL}${PATH}`,
    isPartOf: { '@type': 'WebSite', name: 'AEO Toolkit', url: SITE_URL },
  };

  const howTo: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to map a backlink graph in 3D',
    description:
      'Build an interactive 3D backlink graph for any URL from free open-web indexes, then explore referring domains, dofollow links, and brand mentions.',
    step: HOW_TO_STEPS.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };

  const faqPage: Record<string, unknown> = {
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
      <JsonLd data={[webPage, breadcrumb, howTo, faqPage]} />

      <Container className="flex max-w-6xl flex-col gap-10 py-10 sm:gap-12 sm:py-14">
        {/* Tool hero — single h1, answer-first intro. */}
        <header className="flex flex-col gap-5">
          <Breadcrumb trail={TRAIL} />

          <div className="flex flex-col gap-4">
            <Badge tone="violet">3D Explorer</Badge>
            <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
              Backlink <GradientText>Graph</GradientText>
            </h1>
            <p className="max-w-2xl text-pretty text-base leading-relaxed text-slate-400 sm:text-lg">
              See any site’s backlink universe as an interactive 3D map. The Backlink Graph renders
              referring domains, backlink pages, and brand mentions discovered from open web indexes
              — so you can spot your strongest link sources, dofollow vs nofollow balance, and
              competitor overlap at a glance. Enter a URL below to build it.
            </p>
          </div>

          {/* Sampled, not a complete index — set expectations up front. */}
          <div className="flex max-w-2xl items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 text-xs leading-relaxed text-slate-400">
            <svg
              viewBox="0 0 16 16"
              width="15"
              height="15"
              fill="none"
              aria-hidden
              className="mt-px shrink-0 text-brand-cyan"
            >
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M8 7.2v4M8 5h.01"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span>
              Data is <strong className="font-semibold text-slate-300">sampled</strong> from open
              indexes (DuckDuckGo, CommonCrawl, Wayback) — it is a directional view, not a complete
              index like a paid backlink tool.
            </span>
          </div>
        </header>

        {/* The interactive 3D explorer island. */}
        <GraphExplorer />

        {/* FAQ — visible HTML mirrored by the FAQPage JSON-LD above. */}
        <Reveal>
          <section aria-labelledby="graph-faq-heading" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="eyebrow">FAQ</span>
              <h2
                id="graph-faq-heading"
                className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
              >
                Backlink Graph questions
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {FAQS.map((faq) => (
                <SpotlightCard key={faq.q} className="p-5 sm:p-6">
                  <h3 className="text-base font-semibold text-white">{faq.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{faq.a}</p>
                </SpotlightCard>
              ))}
            </div>
          </section>
        </Reveal>
      </Container>
    </>
  );
}
