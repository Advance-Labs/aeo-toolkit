/**
 * `aeoRules` — answer-engine-optimization heuristics.
 *
 * These rules measure how readily an LLM-backed answer engine (ChatGPT,
 * Claude, Perplexity, Google AI Overviews) can find, extract, and cite the
 * page's content: question-shaped headings, FAQ/QA schema, author/article
 * markup, organization identity, AI-bot crawl permission, and extractable
 * structure (lists, decent word count). All accessors are defensive.
 */
import type { Rule, ScoringContext } from '@advance-labs/types';
import { isSingleRootPage, KEY_AI_BOTS, firstStructured, meanOverPages, normalizeUrl } from './context-utils.js';

const ANSWERABLE_MIN_WORDS = 300;

/**
 * Schema types whose date properties describe the PRIMARY content of a page.
 * An Event's startDate or a Review's datePublished says nothing about whether
 * the page's own copy is maintained, so those types are deliberately excluded.
 */
const DATEABLE_TYPES = new Set(['Article', 'NewsArticle', 'BlogPosting', 'TechArticle', 'WebPage']);

/** Host without a leading `www.`, or undefined when the value will not parse as a URL. */
function hostOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/**
 * Whether a schema node's identifier points at the site being audited, rather than at some
 * third party the site is describing.
 *
 * Subdomains count as the same site: `aeo.example.com` and `example.com` publishing
 * contradictory Organization nodes is exactly the entity split worth flagging, whereas
 * `someclient.com` on a case-study page is correct markup and must not be flagged.
 *
 * A node with no usable identifier is treated as first-party — it carries no evidence of being
 * about anyone else, and an unidentified Organization on your own site is most likely yours.
 */
function describesSameSite(rootUrl: string, identifier: string | undefined): boolean {
  const root = hostOf(rootUrl);
  const target = hostOf(identifier);
  if (root === undefined) return true; // cannot tell; do not silently drop nodes
  if (target === undefined) return true;
  return target === root || target.endsWith(`.${root}`) || root.endsWith(`.${target}`);
}

/** Aggregate booleans across all structured-data reports with OR semantics. */
function anyStructured(
  ctx: ScoringContext,
  select: (r: ScoringContext['structuredData'][number]) => boolean,
): boolean {
  return ctx.structuredData.some(select);
}

export const aeoRules: Rule[] = [
  {
    id: 'aeo.faq-qa-schema',
    category: 'aeo',
    severity: 'high',
    weight: 8,
    title: 'FAQ or QA schema is present',
    description: 'FAQPage/QAPage markup feeds answer engines ready-made Q&A pairs.',
    recommendation: 'Mark up your FAQ section with FAQPage JSON-LD.',
    docsUrl: 'https://schema.org/FAQPage',
    evaluate: (ctx) => {
      const fromSchema = anyStructured(ctx, (r) => r.hasFaqOrQa);
      const fromHtml = ctx.pages.some((p) => p.content.hasFaq);
      return fromSchema || fromHtml
        ? { passed: true }
        : { passed: false, detail: 'No FAQ/QA content or schema detected.' };
    },
  },
  {
    id: 'aeo.question-headings',
    category: 'aeo',
    severity: 'high',
    weight: 7,
    title: 'Content uses question-shaped headings',
    description: 'Headings phrased as questions match how users query AI assistants.',
    recommendation: 'Add headings like "How does X work?" above their answers.',
    evaluate: (ctx) => {
      const total = ctx.pages.reduce((acc, p) => acc + p.content.questionHeadingCount, 0);
      return total > 0
        ? { passed: true }
        : { passed: false, detail: 'No question-phrased headings found.' };
    },
  },
  {
    id: 'aeo.answerable-content',
    category: 'aeo',
    severity: 'medium',
    weight: 6,
    title: 'Content is answerable (sufficient depth + lists)',
    description: 'Engines prefer pages with enough text and scannable lists to quote.',
    recommendation: `Aim for ${ANSWERABLE_MIN_WORDS}+ words and use lists for key facts.`,
    evaluate: (ctx) => {
      const meanWords = meanOverPages(ctx, (p) => p.content.wordCount, 0);
      const totalLists = ctx.pages.reduce((acc, p) => acc + p.content.listCount, 0);
      const passed = meanWords >= ANSWERABLE_MIN_WORDS && totalLists > 0;
      return passed
        ? { passed: true }
        : {
            passed: false,
            detail: `Mean words ${Math.round(meanWords)}, lists ${totalLists}.`,
          };
    },
  },
  {
    id: 'aeo.article-author-schema',
    category: 'aeo',
    severity: 'medium',
    weight: 5,
    // A homepage is not an article. Marking one up as `Article` to satisfy this rule would
    // be actively misleading markup, so the rule does not apply there. See ADV-175.
    appliesTo: (ctx) => !isSingleRootPage(ctx),
    title: 'Article and author schema are present',
    description: 'Article + Person markup attributes content for E-E-A-T and citation.',
    recommendation: 'Add Article JSON-LD with an author of type Person.',
    docsUrl: 'https://schema.org/Article',
    evaluate: (ctx) => {
      const hasArticle = anyStructured(ctx, (r) => r.hasArticle);
      const hasPerson = anyStructured(ctx, (r) => r.hasPerson);
      return hasArticle && hasPerson
        ? { passed: true }
        : {
            passed: false,
            detail: `Article: ${hasArticle ? 'yes' : 'no'}, Author/Person: ${hasPerson ? 'yes' : 'no'}.`,
          };
    },
  },
  {
    id: 'aeo.organization-schema',
    category: 'aeo',
    severity: 'medium',
    weight: 5,
    title: 'Organization schema is present',
    description: 'Organization markup builds entity identity that engines trust.',
    recommendation: 'Add Organization JSON-LD with name, url, and logo.',
    docsUrl: 'https://schema.org/Organization',
    evaluate: (ctx) => {
      const sd = firstStructured(ctx);
      const present =
        anyStructured(ctx, (r) => r.hasOrganization) || (sd?.hasOrganization ?? false);
      return present ? { passed: true } : { passed: false, detail: 'No Organization schema.' };
    },
  },
  {
    // Added 2026-08-01. advancelabs.dev and aeo.advancelabs.dev each published an Organization
    // for the same company under a DIFFERENT @id, which `aeo.organization-schema` passes without
    // complaint because both are present and well-formed. To an answer engine that is two
    // unrelated companies that happen to share a name, so neither accumulates the other's
    // corroboration — the precise signal this whole rule family exists to build.
    id: 'aeo.entity-identity-consistent',
    category: 'aeo',
    severity: 'high',
    weight: 6,
    title: 'Organization identity is consistent across pages',
    description:
      'Every page should describe the same entity. Conflicting @id or url values on Organization nodes split one company into several the engine cannot merge.',
    recommendation:
      'Give Organization one stable @id (e.g. https://example.com/#organization) and one url, and reuse them verbatim on every page and property.',
    docsUrl: 'https://schema.org/Organization',
    evaluate: (ctx) => {
      const ids = new Set<string>();
      const urls = new Set<string>();
      let orgCount = 0;

      for (const report of ctx.structuredData) {
        for (const item of report.items) {
          if (item.type !== 'Organization') continue;
          const id = typeof item.properties['@id'] === 'string' ? item.properties['@id'] : undefined;
          const url = typeof item.properties['url'] === 'string' ? item.properties['url'] : undefined;

          // Only compare Organization nodes that describe THIS site. A case study, client list,
          // or partner page legitimately marks up other companies, and treating those as
          // contradictions would fail every agency site that shows its work — advancelabs.dev
          // included, which is how this was caught.
          if (!describesSameSite(ctx.crawl.rootUrl, id ?? url)) continue;

          orgCount += 1;
          // keepFragment: an @id IS its fragment. `/#organization` and `/#org` are distinct
          // nodes, and collapsing them would hide the most common form of this defect.
          if (id?.trim()) ids.add(normalizeUrl(id, { keepFragment: true }));
          if (url?.trim()) urls.add(normalizeUrl(url));
        }
      }

      // Presence is aeo.organization-schema's job. With none, or only one, there is no conflict
      // to find, and a missing @id is a weaker (separate) concern than a contradictory one.
      if (orgCount < 2)
        return { passed: true, detail: 'Fewer than two first-party Organization nodes to compare.' };

      const conflicts: string[] = [];
      if (ids.size > 1) conflicts.push(`${ids.size} different @id values`);
      if (urls.size > 1) conflicts.push(`${urls.size} different url values`);
      if (conflicts.length === 0) return { passed: true };

      return {
        passed: false,
        detail: `Organization nodes disagree: ${conflicts.join(' and ')}.`,
      };
    },
  },
  {
    id: 'aeo.ai-bots-allowed',
    category: 'aeo',
    severity: 'critical',
    weight: 9,
    title: 'AI crawlers are not blocked',
    description: 'Blocking GPTBot/ClaudeBot/PerplexityBot removes you from AI answers.',
    recommendation: 'Allow key AI user-agents in robots.txt unless you must opt out.',
    evaluate: (ctx) => {
      // Empty directive list means nothing was explicitly blocked — pass.
      const blocked = ctx.crawl.robots.aiBotDirectives
        .filter((d) => !d.allowed && (KEY_AI_BOTS as readonly string[]).includes(d.bot))
        .map((d) => d.bot);
      return blocked.length === 0
        ? { passed: true }
        : { passed: false, detail: `Blocked: ${blocked.join(', ')}.` };
    },
  },
  {
    id: 'aeo.llms-txt-present',
    category: 'aeo',
    severity: 'medium',
    weight: 5,
    title: 'llms.txt is present for answer engines',
    description: 'llms.txt is the emerging standard manifest for LLM-friendly content.',
    recommendation: 'Generate and publish an llms.txt at your site root.',
    docsUrl: 'https://llmstxt.org/',
    evaluate: (ctx) => ({ passed: ctx.crawl.filePresence.llmsTxt }),
  },
  {
    id: 'aeo.speakable-structured-answers',
    category: 'aeo',
    severity: 'low',
    weight: 3,
    title: 'Content has structured, extractable answers',
    description: 'Speakable markup or HowTo/QA structure yields voice/AI-ready answers.',
    recommendation: 'Add Speakable or HowTo schema to highlight answer passages.',
    evaluate: (ctx) => {
      const sd = firstStructured(ctx);
      const speakable = ctx.structuredData.some((r) =>
        r.aeoTypesPresent.some((t) => t === 'Speakable' || t === 'HowTo' || t === 'QAPage'),
      );
      const howTo = ctx.pages.some((p) => p.content.hasHowTo);
      return speakable || howTo || (sd?.hasFaqOrQa ?? false)
        ? { passed: true }
        : { passed: false, detail: 'No speakable / HowTo / QA structure.' };
    },
  },
  {
    id: 'aeo.breadcrumbs',
    category: 'aeo',
    severity: 'low',
    weight: 3,
    // A homepage is the ROOT of the breadcrumb trail; a one-item trail pointing at itself is
    // noise, and Google does not expect breadcrumbs there. See ADV-175.
    appliesTo: (ctx) => !isSingleRootPage(ctx),
    title: 'Breadcrumb structured data is present',
    description: 'BreadcrumbList markup clarifies site structure for engines.',
    recommendation: 'Add BreadcrumbList JSON-LD reflecting your navigation path.',
    docsUrl: 'https://schema.org/BreadcrumbList',
    evaluate: (ctx) => {
      const sd = firstStructured(ctx);
      const present = anyStructured(ctx, (r) => r.hasBreadcrumb) || (sd?.hasBreadcrumb ?? false);
      return present ? { passed: true } : { passed: false, detail: 'No breadcrumb schema.' };
    },
  },
  {
    id: 'aeo.content-extractability',
    category: 'aeo',
    severity: 'medium',
    weight: 5,
    title: 'Content is extractable (paragraphs + lists/tables)',
    description: 'Engines extract best from well-formed paragraphs, lists, and tables.',
    recommendation: 'Structure content into clear paragraphs, lists, and tables.',
    evaluate: (ctx) => {
      const meanParagraphs = meanOverPages(ctx, (p) => p.content.paragraphCount, 0);
      const structureCount = ctx.pages.reduce(
        (acc, p) => acc + p.content.listCount + p.content.tableCount,
        0,
      );
      return meanParagraphs >= 3 && structureCount > 0
        ? { passed: true }
        : {
            passed: false,
            detail: `Mean paragraphs ${Math.round(meanParagraphs)}, lists+tables ${structureCount}.`,
          };
    },
  },
  {
    // Added for #11. Checks that a date EXISTS and PARSES, deliberately not how recent
    // it is — a 2019 date on a reference page is correct, and penalizing it would flag
    // good content. The two failure details are different fixes for the site owner:
    // "no date" means add the property, "unparseable" means fix its format.
    id: 'aeo.content-freshness',
    category: 'aeo',
    severity: 'medium',
    weight: 5,
    title: 'Content declares a modification date',
    description: 'A parseable dateModified gives engines a reason to cite the page over undated competitors.',
    recommendation: 'Add dateModified (or datePublished) in ISO 8601 to your Article/WebPage JSON-LD.',
    docsUrl: 'https://schema.org/dateModified',
    evaluate: (ctx) => {
      const values: unknown[] = [];
      for (const report of ctx.structuredData) {
        for (const item of report.items) {
          if (!DATEABLE_TYPES.has(item.type)) continue;
          const value = item.properties['dateModified'] ?? item.properties['datePublished'];
          if (value !== undefined && value !== null) values.push(value);
        }
      }

      if (values.length === 0) {
        return {
          passed: false,
          detail: 'No dateModified or datePublished found on Article/WebPage structured data.',
        };
      }
      const anyParseable = values.some(
        (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value)),
      );
      if (anyParseable) return { passed: true };
      return {
        passed: false,
        detail: `Date present but unparseable: "${String(values[0])}". Use ISO 8601 (e.g. "2026-05-01").`,
      };
    },
  },
];
