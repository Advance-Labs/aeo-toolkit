/**
 * `aeoRules` — answer-engine-optimization heuristics.
 *
 * These rules measure how readily an LLM-backed answer engine (ChatGPT,
 * Claude, Perplexity, Google AI Overviews) can find, extract, and cite the
 * page's content: question-shaped headings, FAQ/QA schema, author/article
 * markup, organization identity, AI-bot crawl permission, and extractable
 * structure (lists, decent word count). All accessors are defensive.
 */
import type { Rule, ScoringContext } from '@aeo/types';
import { KEY_AI_BOTS, firstStructured, meanOverPages } from './context-utils.js';

const ANSWERABLE_MIN_WORDS = 300;

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
];
