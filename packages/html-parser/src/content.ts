/** Visible-text content signals: word count, FAQ/HowTo, question headings, structure counts. */
import type { CheerioAPI } from 'cheerio';
import type { ContentSignals, HeadingNode, RawStructuredDataBlock } from '@advance-labs/types';

import { jsonLdHasType } from './structured-data.js';

/** Elements whose text is not visible page content and must be excluded. */
const NON_VISIBLE_SELECTOR = 'script, style, noscript, template, head';

/**
 * Mount points single-page apps render into. `#__next` is included deliberately: a
 * server-rendered Next page fills it, a client-only one leaves it empty, and it is the
 * emptiness, not the element, that carries the signal.
 */
const APP_SHELL_SELECTOR = '#root, #app, #__next, [data-reactroot], [data-server-rendered]';

/** A heading is question-like if it ends with `?` or opens with an interrogative. */
const QUESTION_WORDS = new Set([
  'who',
  'what',
  'when',
  'where',
  'why',
  'how',
  'which',
  'can',
  'should',
  'is',
  'are',
  'do',
  'does',
  'will',
]);

/** Count whitespace-delimited words in visible body text. */
function countWords(text: string): number {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return 0;
  return normalized.split(' ').length;
}

/**
 * Whether the page ships an app shell with nothing in it.
 *
 * Checks each candidate mount point for visible text after stripping non-visible nodes. An
 * empty one means the served HTML carries no content for a crawler to read. Returns false
 * when no mount point exists at all, so a conventional server-rendered page is never flagged.
 */
function detectEmptyAppShell($: CheerioAPI): boolean {
  const shells = $(APP_SHELL_SELECTOR);
  if (shells.length === 0) return false;
  return shells.toArray().some((el) => {
    const $shell = $(el).clone();
    $shell.find(NON_VISIBLE_SELECTOR).remove();
    return $shell.text().replace(/\s+/g, ' ').trim().length === 0;
  });
}

/** Whether a heading reads as a question (terminal `?` or leading question word). */
export function isQuestionHeading(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return false;
  if (normalized.endsWith('?')) return true;
  const firstWord =
    normalized
      .toLowerCase()
      .split(' ')[0]
      ?.replace(/[^a-z]/g, '') ?? '';
  return QUESTION_WORDS.has(firstWord);
}

/** Whether any heading text mentions "FAQ" or "frequently asked questions". */
function headingsMentionFaq(headings: HeadingNode[]): boolean {
  return headings.some((h) => {
    const t = h.text.toLowerCase();
    return t.includes('faq') || t.includes('frequently asked question');
  });
}

/** Whether any heading text signals a how-to / step-by-step guide. */
function headingsMentionHowTo(headings: HeadingNode[]): boolean {
  return headings.some((h) => {
    const t = h.text.toLowerCase();
    return t.includes('how to') || t.includes('how-to') || t.includes('step-by-step');
  });
}

/**
 * Compute content-quality signals from visible text plus already-extracted
 * headings and structured-data blocks.
 *
 * `hasFaq`  = an FAQ-flavored heading OR an FAQPage/QAPage JSON-LD block.
 * `hasHowTo`= a how-to heading OR a HowTo JSON-LD block.
 */
export function computeContentSignals(
  $: CheerioAPI,
  headings: HeadingNode[],
  structuredData: RawStructuredDataBlock[],
): ContentSignals {
  // Clone-free visible-text extraction: remove non-visible nodes, then read body.
  const $body = $('body').clone();
  $body.find(NON_VISIBLE_SELECTOR).remove();
  const visibleText = $body.text();

  const hasFaq =
    headingsMentionFaq(headings) ||
    jsonLdHasType(structuredData, 'FAQPage') ||
    jsonLdHasType(structuredData, 'QAPage');

  const hasHowTo = headingsMentionHowTo(headings) || jsonLdHasType(structuredData, 'HowTo');

  const questionHeadingCount = headings.filter((h) => isQuestionHeading(h.text)).length;

  return {
    wordCount: countWords(visibleText),
    hasFaq,
    hasHowTo,
    questionHeadingCount,
    paragraphCount: $('p').length,
    listCount: $('ul, ol').length,
    tableCount: $('table').length,
    scriptCount: $('script').length,
    hasEmptyAppShell: detectEmptyAppShell($),
  };
}
