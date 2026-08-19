/**
 * Human-readable descriptions for each `ScoreCategoryKey`, shown under the category bar in the
 * PDF so a non-technical reader understands what the category measures — not just its score.
 * Presentation-only: kept here (rather than on `@aeo/scoring`) so the scoring engine's rule
 * definitions stay free of report-copy concerns.
 */
import type { ScoreCategoryKey } from '@aeo/types';

export const CATEGORY_DESCRIPTIONS: Record<ScoreCategoryKey, string> = {
  crawlability:
    'Can search engines and AI crawlers reach and fetch the site at all — robots.txt rules, sitemap presence, and server-level blocks.',
  indexing:
    'Whether crawled pages are actually allowed into the search index — noindex tags, canonical conflicts, and duplicate/thin-content signals.',
  metadata:
    'The title, meta description, and heading tags on each page — the copy search engines and AI answer engines quote back to users.',
  'structured-data':
    'Schema.org / JSON-LD markup (Organization, LocalBusiness, FAQ, Review, etc.) that lets machines read facts about the business directly, instead of guessing from prose.',
  content:
    'Depth and clarity of on-page content — enough real, specific text per page for a search or AI engine to judge relevance and extract an answer from.',
  aeo:
    'AI answer-engine optimization: llms.txt, AI-crawler access (GPTBot, ClaudeBot, PerplexityBot), and other signals specific to being cited by ChatGPT, Perplexity, and Google AI Overviews.',
  mobile:
    'Mobile usability basics — viewport configuration and responsive rendering, since most local and AI-referred traffic arrives on a phone.',
  security:
    'Baseline transport security (HTTPS) — a prerequisite for indexing, trust, and most modern browser/crawler behavior.',
  social:
    "Open Graph and Twitter Card tags that control how the site's title, description, and image render when shared or cited in social apps and AI chat citation cards.",
};

/** Fallback used only if a future `ScoreCategoryKey` is added without a description yet. */
export const CATEGORY_DESCRIPTION_FALLBACK = 'No description available for this category yet.';

export function categoryDescription(key: ScoreCategoryKey): string {
  return CATEGORY_DESCRIPTIONS[key] ?? CATEGORY_DESCRIPTION_FALLBACK;
}
