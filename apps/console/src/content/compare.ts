/**
 * Comparison-page content (#36). "X vs Y" is the query shape answer engines synthesize
 * recommendation answers from, so each comparison leads with a liftable verdict, then a real
 * table (engines and LLMs both extract tables cleanly), then when-to-use-which guidance.
 *
 * Data-driven so later comparisons are content, not new code: add an entry here and the
 * /compare/[slug] route, sitemap, and llms.txt pick it up.
 */

export interface ComparisonRow {
  dimension: string;
  a: string;
  b: string;
}

export interface Comparison {
  /** URL segment under /compare/. */
  slug: string;
  /** e.g. "AEO vs SEO". */
  title: string;
  /** Metadata title (layout appends " — AEO Toolkit"). */
  metaTitle: string;
  /** ≤160-char metadata description. */
  metaDescription: string;
  /** Column headers: the two things compared. */
  columns: { a: string; b: string };
  /** Answer-first verdict (1–2 liftable sentences). */
  verdict: string;
  /** Depth paragraphs after the table. */
  body: ReadonlyArray<string>;
  /** The comparison table itself. */
  rows: ReadonlyArray<ComparisonRow>;
  /** "Choose A when / choose B when" guidance. */
  chooseA: string;
  chooseB: string;
  /** Visible FAQ, mirrored 1:1 into FAQPage JSON-LD. */
  faq: ReadonlyArray<{ question: string; answer: string }>;
  /** Related links into the topic cluster. */
  related: ReadonlyArray<{ label: string; href: string }>;
}

export const COMPARISONS: ReadonlyArray<Comparison> = [
  {
    slug: 'aeo-vs-seo',
    title: 'AEO vs SEO',
    metaTitle: 'AEO vs SEO — What Actually Changes',
    metaDescription:
      'AEO vs SEO: same foundations, different finish line. See what changes — surface, signals, measurement — and when to invest in each.',
    columns: { a: 'AEO (Answer Engine Optimization)', b: 'SEO (Search Engine Optimization)' },
    verdict:
      'SEO optimizes a site to rank as a link on a search results page; AEO optimizes it to be quoted as a source inside an AI-generated answer. They share the same technical foundations — crawlability, structured data, site quality — but diverge in surface, tactics, and measurement, and as AI answers become the default search experience, AEO is where new visibility is won.',
    rows: [
      {
        dimension: 'Goal',
        a: 'Be cited inside the AI answer (ChatGPT, Claude, Perplexity, AI Overviews)',
        b: 'Rank as high as possible in the list of results (Google, Bing)',
      },
      {
        dimension: 'Who reads your page',
        a: 'An LLM reads it, extracts claims, and decides whether to quote you',
        b: 'A ranking system scores it; the human clicks through and reads it',
      },
      {
        dimension: 'Winners per query',
        a: 'Usually 2–3 cited sources; everything else is invisible',
        b: 'A full page of results; position 8 still gets some clicks',
      },
      {
        dimension: 'Crawl access',
        a: 'robots.txt must allow GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot; llms.txt curates',
        b: 'robots.txt must allow Googlebot/Bingbot; sitemap.xml enumerates',
      },
      {
        dimension: 'Content shape that wins',
        a: 'Answer-first openings, question headings, lists and tables an LLM can lift verbatim',
        b: 'Keyword-targeted pages with depth, internal links, and engagement',
      },
      {
        dimension: 'Trust signals',
        a: 'E-E-A-T the engine can verify mechanically: Person/Organization schema, consistent entity, citations',
        b: 'E-E-A-T plus classic authority: backlinks, brand queries, engagement',
      },
      {
        dimension: 'Measurement',
        a: 'Citation rate and position per query per engine, tracked over time',
        b: 'Rankings, impressions, CTR, organic sessions (Search Console, analytics)',
      },
    ],
    body: [
      'The deeper difference is economic. A results page distributes attention across ten links, so SEO tolerates partial wins. An AI answer concentrates attention on the two or three sources the engine chose to trust, so AEO is closer to winner-take-most — which is why the citability signals (extractable structure, verifiable identity) repay effort so steeply.',
      'None of this makes SEO obsolete. Answer engines retrieve candidate sources using search indexes, so a page that is unindexable or ranks nowhere rarely enters the candidate pool at all. Think of SEO as qualifying for consideration and AEO as winning the selection: the same crawl budget, schema, and content quality feed both, and the audit that finds your gaps should check both — which is what this toolkit is for.',
    ],
    chooseA:
      'Prioritize AEO work when your audience already asks assistants for recommendations, when definitional or comparison queries drive your funnel, or when you rank respectably but AI answers never mention you.',
    chooseB:
      'Prioritize classic SEO work when your site has indexing or crawl problems, when you have no rankings to build citation candidacy from, or when your queries still return classic link results rather than AI answers.',
    faq: [
      {
        question: 'Does AEO replace SEO?',
        answer:
          'No — it extends it. Answer engines find their candidate sources through search-style retrieval, so classic SEO fundamentals (crawlability, indexing, quality content) remain the entry ticket. AEO adds the layer that decides whether a retrievable page actually gets cited: AI-crawler access, llms.txt, extractable answer-shaped writing, and machine-verifiable trust signals.',
      },
      {
        question: 'Can the same page be optimized for both?',
        answer:
          'Yes, and the best pages are. An answer-first opening followed by depth serves the human reader, the ranking system, and the quoting LLM at once; FAQPage and HowTo markup produce rich results in classic search and pre-extracted answers for AI engines. The toolkit’s audit scores both rule families on the same crawl.',
      },
      {
        question: 'How do I measure AEO the way I measure SEO rankings?',
        answer:
          'Track citations instead of positions: ask each engine the questions your customers ask, record whether you are cited and where you appear among named competitors, and repeat on a schedule. Alongside it, watch AI-referral sessions in analytics and keep auditing the on-page signals so you know why the citation trend moved.',
      },
    ],
    related: [
      { label: 'What is AEO?', href: '/glossary/answer-engine-optimization' },
      { label: 'What is an answer engine?', href: '/glossary/answer-engine' },
      { label: 'The complete AEO guide', href: '/guide/answer-engine-optimization' },
      { label: 'Run a free SEO + AEO audit', href: '/tools/audit' },
    ],
  },
];

/** Comparison lookup by slug; undefined when the slug is not a published comparison. */
export function comparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
