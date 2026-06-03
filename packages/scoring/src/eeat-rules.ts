/**
 * `eeatRules` + `eeatScore` — the four-pillar E-E-A-T scorer.
 *
 * Unlike the technical/AEO rule engine (which yields `Finding[]`), E-E-A-T is
 * modeled as boolean *signals* grouped by pillar. Each pillar's score is the
 * weighted fraction of its signals that are present, scaled to 0..100. The
 * overall is the mean of the four pillar scores, and `improvements[]` collects
 * the recommendations of every failed (absent) signal, heaviest first.
 *
 * Pillars:
 *   - Experience: content depth; FAQ/HowTo/Review schema.
 *   - Expertise: author bylines; Person schema; Article markup; about page.
 *   - Authoritativeness: Organization schema; breadcrumbs; outbound reference
 *     links; internal linking.
 *   - Trust: HTTPS; contact/privacy/terms pages; canonical coverage; OG completeness.
 */
import type { EeatPillar, EeatPillarKey, EeatReport, EeatSignal, ScoringContext } from '@aeo/types';
import { clampScore, scoreToGrade } from './grade.js';
import { firstStructured, meanOverPages } from './context-utils.js';

const EXPERIENCE_MIN_WORDS = 600;
const OUTBOUND_REF_MIN = 1;
const INTERNAL_LINK_MIN = 3;

/** A signal definition: pillar + weight + how to detect presence + advice. */
interface SignalDef {
  id: string;
  pillar: EeatPillarKey;
  label: string;
  weight: number;
  recommendation: string;
  detect: (ctx: ScoringContext) => { present: boolean; evidence?: string };
}

const PILLAR_LABELS: Record<EeatPillarKey, string> = {
  experience: 'Experience',
  expertise: 'Expertise',
  authoritativeness: 'Authoritativeness',
  trust: 'Trust',
};

/** Does any crawled or parsed page URL match the given path pattern? */
function hasPageMatching(ctx: ScoringContext, pattern: RegExp): boolean {
  for (const p of ctx.pages) {
    if (pattern.test(p.url)) return true;
  }
  for (const p of ctx.crawl.pages) {
    if (pattern.test(p.url) || pattern.test(p.finalUrl)) return true;
  }
  return false;
}

function anyStructured(
  ctx: ScoringContext,
  select: (r: ScoringContext['structuredData'][number]) => boolean,
): boolean {
  return ctx.structuredData.some(select);
}

/** Total external (outbound) links across all parsed pages. */
function totalExternalLinks(ctx: ScoringContext): number {
  return ctx.pages.reduce((acc, p) => acc + p.externalLinkCount, 0);
}

const SIGNAL_DEFS: SignalDef[] = [
  // ── Experience ──────────────────────────────────────────────────────────
  {
    id: 'eeat.exp.content-depth',
    pillar: 'experience',
    label: 'Content has first-hand depth',
    weight: 6,
    recommendation: 'Expand key pages with detailed, first-hand explanation and examples.',
    detect: (ctx) => {
      const mean = meanOverPages(ctx, (p) => p.content.wordCount, 0);
      return { present: mean >= EXPERIENCE_MIN_WORDS, evidence: `mean ${Math.round(mean)} words` };
    },
  },
  {
    id: 'eeat.exp.faq-howto-review-schema',
    pillar: 'experience',
    label: 'FAQ / HowTo / Review schema present',
    weight: 5,
    recommendation: 'Add FAQPage, HowTo, or Review schema reflecting hands-on experience.',
    detect: (ctx) => {
      const present =
        anyStructured(ctx, (r) => r.hasFaqOrQa) ||
        ctx.structuredData.some((r) =>
          r.aeoTypesPresent.some((t) => t === 'HowTo' || t === 'Review'),
        ) ||
        ctx.pages.some((p) => p.content.hasFaq || p.content.hasHowTo);
      return { present };
    },
  },

  // ── Expertise ───────────────────────────────────────────────────────────
  {
    id: 'eeat.expertise.person-schema',
    pillar: 'expertise',
    label: 'Author identified via Person schema',
    weight: 6,
    recommendation: 'Mark up content authors with Person JSON-LD (name, sameAs, jobTitle).',
    detect: (ctx) => {
      const sd = firstStructured(ctx);
      return { present: anyStructured(ctx, (r) => r.hasPerson) || (sd?.hasPerson ?? false) };
    },
  },
  {
    id: 'eeat.expertise.article-markup',
    pillar: 'expertise',
    label: 'Article / BlogPosting markup present',
    weight: 5,
    recommendation: 'Wrap editorial content in Article or BlogPosting JSON-LD.',
    detect: (ctx) => {
      const sd = firstStructured(ctx);
      return { present: anyStructured(ctx, (r) => r.hasArticle) || (sd?.hasArticle ?? false) };
    },
  },
  {
    id: 'eeat.expertise.about-page',
    pillar: 'expertise',
    label: 'About page exists',
    weight: 4,
    recommendation: 'Publish an About page describing the team and their credentials.',
    detect: (ctx) => ({
      present: hasPageMatching(ctx, /\/(about|about-us|team|who-we-are)(\/|$|\?)/i),
    }),
  },

  // ── Authoritativeness ───────────────────────────────────────────────────
  {
    id: 'eeat.auth.organization-schema',
    pillar: 'authoritativeness',
    label: 'Organization schema present',
    weight: 6,
    recommendation: 'Add Organization JSON-LD with name, logo, and sameAs profiles.',
    detect: (ctx) => {
      const sd = firstStructured(ctx);
      return {
        present: anyStructured(ctx, (r) => r.hasOrganization) || (sd?.hasOrganization ?? false),
      };
    },
  },
  {
    id: 'eeat.auth.breadcrumbs',
    pillar: 'authoritativeness',
    label: 'Breadcrumb navigation marked up',
    weight: 3,
    recommendation: 'Add BreadcrumbList schema reflecting your site hierarchy.',
    detect: (ctx) => {
      const sd = firstStructured(ctx);
      return {
        present: anyStructured(ctx, (r) => r.hasBreadcrumb) || (sd?.hasBreadcrumb ?? false),
      };
    },
  },
  {
    id: 'eeat.auth.outbound-references',
    pillar: 'authoritativeness',
    label: 'Cites outbound references',
    weight: 4,
    recommendation: 'Link out to authoritative sources to support your claims.',
    detect: (ctx) => {
      const total = totalExternalLinks(ctx);
      return { present: total >= OUTBOUND_REF_MIN, evidence: `${total} external link(s)` };
    },
  },
  {
    id: 'eeat.auth.internal-linking',
    pillar: 'authoritativeness',
    label: 'Strong internal linking',
    weight: 3,
    recommendation: 'Interlink related pages to demonstrate topical authority.',
    detect: (ctx) => {
      const mean = meanOverPages(ctx, (p) => p.internalLinkCount, 0);
      return {
        present: mean >= INTERNAL_LINK_MIN,
        evidence: `mean ${Math.round(mean)} internal links`,
      };
    },
  },

  // ── Trust ───────────────────────────────────────────────────────────────
  {
    id: 'eeat.trust.https',
    pillar: 'trust',
    label: 'Served over HTTPS',
    weight: 6,
    recommendation: 'Serve the entire site over HTTPS.',
    detect: (ctx) => ({ present: ctx.crawl.https }),
  },
  {
    id: 'eeat.trust.contact-page',
    pillar: 'trust',
    label: 'Contact page exists',
    weight: 4,
    recommendation: 'Publish a Contact page with a real way to reach you.',
    detect: (ctx) => ({
      present: hasPageMatching(ctx, /\/(contact|contact-us|support)(\/|$|\?)/i),
    }),
  },
  {
    id: 'eeat.trust.privacy-terms',
    pillar: 'trust',
    label: 'Privacy / Terms pages exist',
    weight: 4,
    recommendation: 'Publish Privacy Policy and Terms pages.',
    detect: (ctx) => ({
      present: hasPageMatching(
        ctx,
        /\/(privacy|privacy-policy|terms|terms-of-service|tos|legal)(\/|$|\?)/i,
      ),
    }),
  },
  {
    id: 'eeat.trust.canonical-coverage',
    pillar: 'trust',
    label: 'Canonical tags cover pages',
    weight: 3,
    recommendation: 'Add canonical tags to consolidate duplicate URLs.',
    detect: (ctx) => {
      if (ctx.pages.length === 0) return { present: false };
      const withCanonical = ctx.pages.filter((p) => Boolean(p.meta.canonical)).length;
      const coverage = withCanonical / ctx.pages.length;
      return { present: coverage >= 0.8, evidence: `${Math.round(coverage * 100)}% coverage` };
    },
  },
  {
    id: 'eeat.trust.og-completeness',
    pillar: 'trust',
    label: 'OpenGraph metadata complete',
    weight: 2,
    recommendation: 'Complete OpenGraph tags (title, description, image, url) on key pages.',
    detect: (ctx) => {
      if (ctx.pages.length === 0) return { present: false };
      const complete = ctx.pages.filter((p) => p.openGraph.complete).length;
      return { present: complete / ctx.pages.length >= 0.5 };
    },
  },
];

/** The pillar order in which signals/pillars are reported. */
const PILLAR_ORDER: EeatPillarKey[] = ['experience', 'expertise', 'authoritativeness', 'trust'];

/** Evaluate every signal definition against the context. */
function evaluateSignals(ctx: ScoringContext): EeatSignal[] {
  return SIGNAL_DEFS.map((def) => {
    const { present, evidence } = def.detect(ctx);
    const signal: EeatSignal = {
      id: def.id,
      pillar: def.pillar,
      label: def.label,
      present,
      weight: def.weight,
      recommendation: def.recommendation,
    };
    if (evidence) signal.evidence = evidence;
    return signal;
  });
}

/** Build a pillar from the signals that belong to it. */
function buildPillar(key: EeatPillarKey, signals: EeatSignal[]): EeatPillar {
  let presentWeight = 0;
  let totalWeight = 0;
  for (const s of signals) {
    const w = s.weight > 0 ? s.weight : 0;
    totalWeight += w;
    if (s.present) presentWeight += w;
  }
  const score = totalWeight > 0 ? clampScore((presentWeight / totalWeight) * 100) : 0;
  return { key, label: PILLAR_LABELS[key], score: Math.round(score), signals };
}

/**
 * Compute the full four-pillar E-E-A-T report for a context.
 * `pagesCrawled` reflects the crawl's page count so callers can surface it.
 */
export function eeatScore(ctx: ScoringContext): EeatReport {
  const signals = evaluateSignals(ctx);

  const byPillar = new Map<EeatPillarKey, EeatSignal[]>();
  for (const key of PILLAR_ORDER) byPillar.set(key, []);
  for (const s of signals) {
    const bucket = byPillar.get(s.pillar);
    if (bucket) bucket.push(s);
  }

  const pillars: EeatPillar[] = PILLAR_ORDER.map((key) =>
    buildPillar(key, byPillar.get(key) ?? []),
  );

  const overall =
    pillars.length > 0
      ? Math.round(pillars.reduce((acc, p) => acc + p.score, 0) / pillars.length)
      : 0;

  // Improvements: recommendations of absent signals, heaviest weight first.
  const improvements = signals
    .filter((s) => !s.present)
    .sort((a, b) => b.weight - a.weight)
    .map((s) => s.recommendation);

  const rootUrl = ctx.crawl.rootUrl;
  return {
    url: rootUrl,
    generatedAt: new Date().toISOString(),
    overall,
    grade: scoreToGrade(overall),
    pillars,
    pagesCrawled: ctx.crawl.pageCount,
    improvements,
  };
}

/**
 * The E-E-A-T signal definitions exposed as inspectable metadata.
 * Apps that want to render the rubric (not just scores) can read this.
 */
export const eeatSignalDefs: readonly Readonly<Omit<SignalDef, 'detect'>>[] = SIGNAL_DEFS.map(
  ({ id, pillar, label, weight, recommendation }) => ({
    id,
    pillar,
    label,
    weight,
    recommendation,
  }),
);
