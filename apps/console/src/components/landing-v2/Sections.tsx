/**
 * Landing v6 — the story cut. "Do less with more": the page is four acts told on
 * scroll — ASK (a customer asks an AI), MEASURE (the instruments scan), READ (the
 * verdict), FIX (work the list, get named) — with content compressed to fragments
 * wherever a sentence restated what a tool page already owns. Server components,
 * complete and readable without JavaScript; scroll behavior lives in Motion.tsx.
 */

import type { JSX } from 'react';
import Link from 'next/link';
import { FAQS, TOOLS } from '@/components/landing';
import { HeroShader } from './HeroShader';
import { NodeFieldViewport } from './NodeFieldViewport';
import { SpecimenReport } from './SpecimenReport';
import { assetUrl } from '@/lib/asset-url';

/** The visible FAQ is cut to three; the page's FAQPage JSON-LD mirrors exactly these. */
export const LANDING_FAQS = FAQS.slice(0, 3);

/* ──────────── Acts I–II · The cinematic stage (Ask → the turn → Know) ──────────── */

const STORY_LINES: ReadonlyArray<string> = [
  'A customer asks.',
  'The engine answers with three names.',
  'Yours isn’t one of them.',
  'But it should be.',
];

/**
 * One pinned stage, two layers. Scrolling zooms the viewer past the hero while the
 * void frame surfaces beneath it; the story lines then play; the pin releases and the
 * page scrolls normally. Without JavaScript (or under reduced motion) the layers render
 * as two ordinary stacked sections — nothing is hidden, nothing pins.
 */
export function CinematicStage(): JSX.Element {
  return (
    <section
      data-stage
      aria-label="Your next customer asks an AI — and why citations matter"
      className="v2-stage relative overflow-hidden"
    >
      {/* The shader field belongs to the stage, not the scaled hero layer: it stays
          fixed in place while the zoom happens, and fades out on its own tween. */}
      <div data-stage-shader className="absolute inset-0 z-0">
        <HeroShader />
      </div>
      {/* Layer 1 · the hero (on top while pinned; scrolling zooms past it). */}
      <div
        data-stage-hero
        className="v2-stage-layer relative flex min-h-[calc(100vh-6.75rem)] flex-col overflow-hidden px-6 pt-6 sm:px-10 sm:pt-10 lg:px-14"
      >
        <div className="relative z-10 my-auto grid w-full items-center gap-7 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
          <div>
            <p className="v2-label" style={{ color: 'var(--v2-signal)' }}>
              01 · Ask
            </p>
            <h1
              data-hero-title
              className="mt-5 max-w-2xl text-balance text-5xl font-bold leading-[0.98] tracking-tighter sm:text-7xl lg:text-8xl"
            >
              Your next customer asks an AI.
            </h1>
            <p
              data-hero-sub
              className="mt-4 max-w-md text-lg leading-relaxed sm:mt-6"
              style={{ color: 'var(--v2-ink-soft)' }}
            >
              Free, open instruments that measure whether the engines can find, parse, and cite
              you.
            </p>

            <form
              data-hero-cta
              action="/tools/audit"
              method="get"
              className="mt-6 flex max-w-md gap-0 sm:mt-8"
            >
              <label htmlFor="hero-url" className="sr-only">
                Website URL to audit
              </label>
              <input
                id="hero-url"
                name="url"
                type="url"
                inputMode="url"
                placeholder="https://yoursite.com"
                className="h-12 w-full border border-r-0 border-white/25 bg-white/[0.07] px-4 font-[var(--font-v2-mono)] text-sm text-[color:var(--v2-text)] backdrop-blur-md placeholder:text-[color:var(--v2-ink-faint)]"
                style={{ borderRadius: '10px 0 0 10px' }}
              />
              <button
                type="submit"
                className="v2-cta h-12 shrink-0 px-5 text-sm font-semibold"
                style={{ borderRadius: '0 10px 10px 0' }}
              >
                Run the audit
              </button>
            </form>
            <p className="v2-label mt-3 sm:mt-4">54 rules · 50 pages · ~60s · no account</p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <NodeFieldViewport />
          </div>
        </div>

        {/* Instrument rail: previews the six measures, fills the hero's bottom band,
            and cues the scroll now that the stage zooms in place. */}
        {/* On phones the rail is one horizontally scrollable line (wrapping it to
            three rows pushed the graph below the fold); from sm it wraps as before. */}
        <div className="relative z-10 mt-auto border-t border-[color:var(--v2-rule)] py-3 sm:py-4">
          <div className="flex flex-nowrap items-baseline gap-x-6 gap-y-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0">
            {['Crawlability', 'AI-bot access', 'Structured data', 'Metadata', 'Answer readiness', 'E-E-A-T'].map(
              (name, i) => (
                <span key={name} className="v2-label whitespace-nowrap">
                  <span style={{ color: 'var(--v2-signal)' }}>{String(i + 1).padStart(2, '0')}</span>{' '}
                  {name}
                </span>
              ),
            )}
            <span className="v2-label ml-auto whitespace-nowrap" style={{ color: 'var(--v2-accent2)' }}>
              Scroll to begin ↓
            </span>
          </div>
        </div>
      </div>

      {/* Layer 2 · the turn (surfaces beneath the hero as it zooms past). */}
      <div
        data-stage-story
        className="v2-stage-layer relative flex min-h-[calc(100vh-6.75rem)] items-center border-t border-[color:var(--v2-rule)] px-6 py-16 sm:px-10 lg:px-14"
      >
        {/* Commissioned void frame as the act backdrop (Higgsfield Soul Cinema, 2026-09-03). */}
        <img
          src={assetUrl('/story/uncited.webp')}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="relative grid w-full items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-6">
            {STORY_LINES.map((line, i) => (
              <p
                key={line}
                data-story-line
                className={
                  i === STORY_LINES.length - 1
                    ? 'v2-cursive max-w-2xl text-balance text-5xl leading-[1.05] sm:text-6xl lg:text-7xl'
                    : 'max-w-2xl text-balance text-4xl font-bold leading-[1.05] tracking-tighter sm:text-5xl lg:text-6xl'
                }
                style={i === STORY_LINES.length - 1 ? { color: 'var(--v2-signal)' } : undefined}
              >
                {line}
              </p>
            ))}
          </div>
          {/* The answer pops in from the side once the resolve lands. */}
          <div data-story-specimen className="flex min-w-0 flex-col items-center gap-4 lg:items-end">
            <p className="v2-label" style={{ color: 'var(--v2-signal)' }}>
              02 · Know — sixty seconds later
            </p>
            <SpecimenReport />
          </div>
        </div>
        <p
          className="v2-label absolute bottom-5 left-6 sm:left-10 lg:left-14"
          style={{ color: 'var(--v2-accent2)' }}
        >
          Uncited is invisible
        </p>
      </div>
    </section>
  );
}

/* ────────────── Narrative frames (commissioned stills, see provenance) ────────────── */

/**
 * Both frames were generated for this design with Higgsfield Soul Cinema (2026-09-03),
 * prompted to this system's world: matte black, one acid-green signal. Local files in
 * /public/story; no third-party assets.
 */
export function StoryFrame({
  src,
  alt,
  label,
}: {
  src: string;
  alt: string;
  label: string;
}): JSX.Element {
  return (
    <figure className="relative m-0 h-[28vh] min-h-[220px] overflow-hidden border-y border-[color:var(--v2-rule)] sm:h-[34vh]">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        data-parallax
        className="absolute inset-0 h-full w-full scale-110 object-cover"
      />
      <figcaption className="v2-label absolute bottom-4 left-6 sm:left-10 lg:left-14" style={{ color: 'var(--v2-accent2)' }}>
        {label}
      </figcaption>
    </figure>
  );
}

/* ────────────────────────── Act II · Measure ────────────────────────── */

const MEASURES: ReadonlyArray<{ n: string; name: string; detail: string }> = [
  { n: '01', name: 'Crawlability', detail: 'robots.txt · sitemaps · canonicals · redirects' },
  { n: '02', name: 'AI-bot access', detail: 'GPTBot · ClaudeBot · PerplexityBot · llms.txt' },
  { n: '03', name: 'Structured data', detail: 'JSON-LD · Microdata · RDFa · citable types' },
  { n: '04', name: 'Metadata', detail: 'titles · descriptions · headings · alt text' },
  { n: '05', name: 'Answer readiness', detail: 'question headings · lists · answer-first' },
  { n: '06', name: 'E-E-A-T', detail: 'experience · expertise · authority · trust' },
];

export function LedgerV2(): JSX.Element {
  return (
    <section className="px-6 py-14 sm:px-10 sm:py-16 lg:px-14" aria-labelledby="measures-h">
      <div data-reveal>
        <p className="v2-label" style={{ color: 'var(--v2-signal)' }}>
          03 · Measure
        </p>
        <h2 id="measures-h" className="mt-3 max-w-lg text-3xl font-bold tracking-tighter sm:text-4xl">
          Six instruments <span className="v2-cursive">scan.</span>
        </h2>
      </div>
      <div className="v2-rule mt-8" data-rule aria-hidden="true" />
      <dl data-scan className="m-0">
        {MEASURES.map((m) => (
          <div
            key={m.n}
            data-scan-item
            className="grid grid-cols-[3rem_1fr] items-baseline gap-x-4 border-b border-[color:var(--v2-rule)] py-4 sm:grid-cols-[4rem_15rem_1fr]"
          >
            <span
              className="v2-scan-n font-[var(--font-v2-mono)] text-sm tabular-nums"
              aria-hidden="true"
            >
              {m.n}
            </span>
            <dt className="text-base font-semibold">{m.name}</dt>
            <dd
              className="col-start-2 m-0 font-[var(--font-v2-mono)] text-xs sm:col-start-3 sm:text-right"
              style={{ color: 'var(--v2-ink-faint)', letterSpacing: '0.04em' }}
            >
              {m.detail}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ────────────────────────── Act IV · Fix ────────────────────────── */

/** One fragment per tool — the sentence lives on the tool page, not here. */
const TOOL_FRAGMENTS: Record<string, string> = {
  '/tools/audit': 'crawl · score · fix list · PDF',
  '/tools/eeat': 'four pillars, exact gaps',
  '/tools/llms-txt': 'generate & download',
  '/tools/chat': 'ask your own GA4 + GSC',
  '/tools/graph': 'the web around you, in 3D',
};

export function InstrumentIndexV2(): JSX.Element {
  return (
    <section
      className="border-t border-[color:var(--v2-rule-strong)] bg-white/[0.03] px-6 py-14 sm:px-10 sm:py-16 lg:px-14"
      aria-labelledby="tools-h"
    >
      <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="v2-label" style={{ color: 'var(--v2-signal)' }}>
            04 · Fix
          </p>
          <h2 id="tools-h" className="mt-3 max-w-lg text-3xl font-bold tracking-tighter sm:text-4xl">
            Work the list. Re-run. <span className="v2-cursive">Get named.</span>
          </h2>
        </div>
        <p className="v2-label">Five tools · free · Apache-2.0</p>
      </div>

      <ol data-reveal-group className="mt-10 list-none p-0">
        {TOOLS.map((tool, i) => (
          <li key={tool.href} data-reveal-item>
            <Link
              href={tool.href}
              className="group grid grid-cols-[3rem_1fr_auto] items-baseline gap-4 border-t border-[color:var(--v2-rule)] py-5 transition-colors hover:bg-white/[0.06] sm:grid-cols-[4rem_1fr_auto_auto]"
            >
              <span
                className="font-[var(--font-v2-mono)] text-sm tabular-nums"
                style={{ color: 'var(--v2-ink-faint)' }}
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-lg font-semibold tracking-tight group-hover:underline">
                {tool.name}
              </span>
              <span
                className="col-start-2 font-[var(--font-v2-mono)] text-xs sm:col-start-3"
                style={{ color: 'var(--v2-ink-faint)', letterSpacing: '0.04em' }}
              >
                {TOOL_FRAGMENTS[tool.href] ?? ''}
              </span>
              <span
                className="hidden font-[var(--font-v2-mono)] text-sm sm:block"
                style={{ color: 'var(--v2-signal)' }}
                aria-hidden="true"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ol>

      {/* Verifiable-facts strip — one line, every claim checkable in the repo. */}
      <p data-reveal className="v2-label mt-12">
        Apache-2.0 · 6 packages on npm · 800+ tests · 3 MCP servers ·{' '}
        <a
          href="https://github.com/Advance-Labs/aeo-toolkit"
          className="underline hover:text-[color:var(--v2-text)]"
        >
          verify on GitHub
        </a>
      </p>
    </section>
  );
}

/* ─────────────────── FAQ (three, mirrored 1:1 in JSON-LD) ─────────────────── */

export function FaqV2(): JSX.Element {
  return (
    <section className="px-6 py-14 sm:px-10 sm:py-16 lg:px-14" aria-labelledby="faq-h">
      <div data-reveal>
        <h2 id="faq-h" className="text-2xl font-bold tracking-tighter sm:text-3xl">
          Asked and <span className="v2-cursive">answered.</span>
        </h2>
      </div>
      <div data-reveal-group className="mt-6">
        {LANDING_FAQS.map((faq) => (
          <details
            key={faq.question}
            data-reveal-item
            className="group border-b border-[color:var(--v2-rule)]"
          >
            <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 py-5 text-base font-semibold [&::-webkit-details-marker]:hidden">
              {faq.question}
              <span
                aria-hidden="true"
                className="shrink-0 font-[var(--font-v2-mono)] transition-transform group-open:rotate-45"
                style={{ color: 'var(--v2-signal)' }}
              >
                +
              </span>
            </summary>
            <p className="max-w-2xl pb-6 text-sm leading-relaxed" style={{ color: 'var(--v2-ink-soft)' }}>
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────── Coda ────────────────────────── */

export function CtaV2(): JSX.Element {
  return (
    <section className="px-6 py-16 text-center sm:py-20" aria-labelledby="cta-h">
      <p className="v2-label" style={{ color: 'var(--v2-signal-ondark)' }}>
        Begin the measurement
      </p>
      <h2
        id="cta-h"
        className="mx-auto mt-4 max-w-2xl text-balance text-4xl font-bold tracking-tighter sm:text-5xl"
        style={{ color: 'var(--v2-paper)' }}
      >
        Sixty seconds from URL to <span className="v2-cursive">graded report.</span>
      </h2>
      <div className="mt-8 flex justify-center">
        <Link
          href="/tools/audit"
          className="v2-cta inline-flex h-12 items-center rounded-xl px-7 text-sm font-semibold"
        >
          Run the audit
        </Link>
      </div>
      <p className="v2-label mt-5" style={{ color: 'var(--v2-ink-faint)' }}>
        Free · no account · your data stays yours
      </p>
    </section>
  );
}
