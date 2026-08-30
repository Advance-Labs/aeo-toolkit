/**
 * Pure URL-path heuristics that group crawled pages into llms.txt sections.
 *
 * The llmstxt.org format wants a small number of human-meaningful sections.
 * We bucket each page by inspecting its URL path segments (docs / blog /
 * product / other) and render sections in a stable, intuitive order.
 */
import type { LlmsTxtEntry, LlmsTxtSection } from '@advance-labs/types';

/** Canonical section keys, in render order. */
export type SectionKey = 'docs' | 'blog' | 'product' | 'other';

const SECTION_HEADINGS: Record<SectionKey, string> = {
  docs: 'Docs',
  blog: 'Blog',
  product: 'Products',
  other: 'Other',
};

const SECTION_ORDER: readonly SectionKey[] = ['docs', 'blog', 'product', 'other'] as const;

/** Path-segment tokens that map a URL into a section bucket. */
const DOCS_TOKENS = [
  'docs',
  'doc',
  'documentation',
  'guide',
  'guides',
  'reference',
  'api',
  'manual',
  'help',
  'learn',
  'tutorial',
  'tutorials',
  'faq',
  'support',
];
const BLOG_TOKENS = [
  'blog',
  'blogs',
  'news',
  'article',
  'articles',
  'post',
  'posts',
  'updates',
  'changelog',
  'press',
];
const PRODUCT_TOKENS = [
  'product',
  'products',
  'pricing',
  'features',
  'feature',
  'solutions',
  'solution',
  'services',
  'service',
  'store',
  'shop',
];

/**
 * Classify a URL into a section by its first few path segments. Falls back to
 * `'other'` for the homepage and anything that does not match a known bucket.
 */
export function classifyUrl(url: string): SectionKey {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    // Not a parseable absolute URL — treat the raw string as the path.
    path = url;
  }

  const segments = path
    .toLowerCase()
    .split('/')
    .filter((segment) => segment !== '');

  for (const segment of segments) {
    if (DOCS_TOKENS.includes(segment)) return 'docs';
    if (BLOG_TOKENS.includes(segment)) return 'blog';
    if (PRODUCT_TOKENS.includes(segment)) return 'product';
  }

  return 'other';
}

/**
 * Group entries into sections using {@link classifyUrl}. Empty buckets are
 * dropped; entries within each section preserve their input (crawl) order.
 */
export function groupIntoSections(entries: LlmsTxtEntry[]): LlmsTxtSection[] {
  const buckets: Record<SectionKey, LlmsTxtEntry[]> = {
    docs: [],
    blog: [],
    product: [],
    other: [],
  };

  for (const entry of entries) {
    const key = classifyUrl(entry.url);
    buckets[key].push(entry);
  }

  const sections: LlmsTxtSection[] = [];
  for (const key of SECTION_ORDER) {
    const bucketEntries = buckets[key];
    if (bucketEntries.length === 0) continue;
    sections.push({ heading: SECTION_HEADINGS[key], entries: bucketEntries });
  }

  return sections;
}
