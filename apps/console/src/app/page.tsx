import type { JSX } from 'react';
import Link from 'next/link';

/**
 * Console dashboard — the unified landing for the AEO Toolkit. Surfaces a card per
 * tool (title, blurb, link to its route segment). Server component: no interactivity,
 * so no `'use client'`. The shell layout (`src/app/layout.tsx`) already provides the
 * nav, header, and the `<main>` wrapper, so this page only renders the grid content.
 */

interface ToolCard {
  href: string;
  title: string;
  blurb: string;
  /** Short emoji-free tag rendered as the card's accent label. */
  tag: string;
}

const TOOLS: readonly ToolCard[] = [
  {
    href: '/tools/audit',
    title: 'LLM & Technical SEO Audit',
    blurb:
      'Crawl up to 50 pages, score technical SEO and answer-engine optimization out of 100, and get a prioritized fix list plus downloadable templates and a PDF report.',
    tag: 'Audit',
  },
  {
    href: '/tools/eeat',
    title: 'E-E-A-T Scanner',
    blurb:
      'Crawl up to 12 pages and score Experience, Expertise, Authoritativeness, and Trust pillar-by-pillar, with the exact signals each page is missing.',
    tag: 'E-E-A-T',
  },
  {
    href: '/tools/llms-txt',
    title: 'llms.txt Generator',
    blurb:
      'Enter a site URL to crawl its pages (sitemap-first), extract titles and descriptions, and generate a structured llms.txt (and optional llms-full.txt) to download.',
    tag: 'llms.txt',
  },
  {
    href: '/tools/chat',
    title: 'GA4 + Search Console Chat',
    blurb:
      'Connect Google read-only, pick a property and site, then ask SEO questions grounded in your own GA4 + Search Console data — answered with your own LLM key (BYOK).',
    tag: 'GA4 + GSC',
  },
  {
    href: '/tools/graph',
    title: 'Backlink Graph',
    blurb:
      'Enter one URL and explore its backlink universe as an interactive 3D force-directed graph, sampled live from open indexes (DuckDuckGo, CommonCrawl, Wayback).',
    tag: 'Backlink Graph',
  },
] as const;

export default function DashboardPage(): JSX.Element {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">AEO Toolkit</h1>
        <p className="max-w-2xl text-sm text-slate-400 sm:text-base">
          One console for the whole answer-engine-optimization suite. Audit your site, score
          E-E-A-T, generate crawl hints for LLMs, chat with your Google data, and map your backlink
          universe — all in a single place.
        </p>
      </header>

      <section aria-label="Tools" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-sm transition hover:border-brand-indigo/60 hover:bg-white/[0.06]"
          >
            <span className="inline-flex w-fit rounded-full border border-brand-indigo/40 bg-brand-indigo/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-brand-cyan">
              {tool.tag}
            </span>
            <h2 className="text-lg font-semibold text-white">{tool.title}</h2>
            <p className="text-sm leading-relaxed text-slate-400">{tool.blurb}</p>
            <span
              aria-hidden
              className="mt-1 text-sm font-medium text-brand-cyan transition group-hover:translate-x-0.5"
            >
              Open tool →
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
