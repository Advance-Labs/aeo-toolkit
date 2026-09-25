/**
 * Shared, render-agnostic content for the marketing landing page. Centralizing the
 * tool/feature/FAQ copy keeps the visible sections and the JSON-LD perfectly in sync
 * (the `FAQPage` schema is derived from the very same `FAQS` array the page renders).
 */

/** A product surface in the toolkit, shown both as a feature value-prop and a tool card. */
export interface ToolEntry {
  href: string;
  /** Short label used as the card title. */
  name: string;
  /** One-line value proposition. */
  blurb: string;
  /** Pill tag / category accent. */
  tag: string;
  /** Key of the inline SVG icon to render (see `Icon`). */
  icon: IconKey;
  /** Which group the tool indexes under on the hub. */
  category: ToolCategory;
}

export type IconKey = 'gauge' | 'shield' | 'doc' | 'chat' | 'graph' | 'spark';

/**
 * Hub groupings. Deliberately three, and deliberately named after what a reader is
 * trying to find out rather than after our architecture: someone arriving from
 * "domain authority checker" is looking for links, not for a console.
 */
export type ToolCategory = 'Audit & AEO' | 'Links & authority' | 'Your own data';

/** Render order for the hub's groups. */
export const TOOL_CATEGORIES: readonly ToolCategory[] = [
  'Audit & AEO',
  'Links & authority',
  'Your own data',
] as const;

export const TOOLS: readonly ToolEntry[] = [
  {
    href: '/tools/audit',
    name: 'LLM & Technical SEO Audit',
    blurb:
      'Crawl up to 50 pages, score technical SEO + AEO out of 100, and get a prioritized fix list with templates and a PDF report.',
    tag: 'Audit',
    icon: 'gauge',
    category: 'Audit & AEO',
  },
  {
    href: '/tools/eeat',
    name: 'E-E-A-T Scanner',
    blurb:
      'Score Experience, Expertise, Authoritativeness, and Trust pillar-by-pillar, with the exact signals each page is missing.',
    tag: 'E-E-A-T',
    icon: 'shield',
    category: 'Audit & AEO',
  },
  {
    href: '/tools/llms-txt',
    name: 'llms.txt Generator',
    blurb:
      'Crawl a site sitemap-first, extract titles and descriptions, and generate a structured llms.txt (and llms-full.txt) to download.',
    tag: 'llms.txt',
    icon: 'doc',
    category: 'Audit & AEO',
  },
  {
    href: '/tools/chat',
    name: 'GA4 + Search Console Chat',
    blurb:
      'Connect Google read-only and ask SEO questions grounded in your own GA4 + Search Console data, answered with your own LLM key.',
    tag: 'GA4 + GSC',
    icon: 'chat',
    category: 'Your own data',
  },
  {
    href: '/tools/graph',
    name: 'Backlink Graph',
    blurb:
      'Explore any URL’s backlink universe as an interactive 3D force-directed graph, sampled live from open web indexes.',
    tag: 'Backlink Graph',
    icon: 'graph',
    category: 'Links & authority',
  },
  {
    href: '/tools/authority',
    name: 'Website Authority Checker',
    blurb:
      'Score any domain against Common Crawl’s public link graph — Open PageRank 0–10, global rank, referring domains, and monthly history back to 2018.',
    tag: 'Authority',
    icon: 'spark',
    category: 'Links & authority',
  },
] as const;

/**
 * Tools that are researched and specified but NOT BUILT.
 *
 * They are listed on the hub under an explicit "not built yet" heading and are
 * deliberately NOT links, NOT in the sitemap, and NOT in llms.txt. A roadmap entry
 * that looks like a shipped tool is vapourware, and on a site whose whole pitch is
 * "we tell you what the metric cannot do" that would be self-refuting.
 *
 * Each carries the data source that makes it buildable at all, because the reason
 * the list is short is that most of the category's tools require a proprietary index
 * nobody can replicate for free. Do not add an entry without one.
 */
export interface PlannedTool {
  name: string;
  category: ToolCategory;
  /** The free or open source this tool would run on. */
  source: string;
}

export const PLANNED_TOOLS: readonly PlannedTool[] = [
  {
    name: 'AI-crawler access checker',
    category: 'Audit & AEO',
    source: 'robots.txt, read directly — GPTBot, ClaudeBot, PerplexityBot, Google-Extended',
  },
  {
    name: 'SERP snippet simulator',
    category: 'Audit & AEO',
    source: 'client-side pixel measurement, no index required',
  },
  {
    name: 'JSON-LD validator',
    category: 'Audit & AEO',
    source: 'the schema.org vocabulary, already vendored by the audit engine',
  },
  {
    name: 'Sitemap generator',
    category: 'Audit & AEO',
    source: 'the same crawler that backs the llms.txt generator',
  },
  {
    name: 'AI traffic checker',
    category: 'Your own data',
    source: 'your own GA4 referrals, classified by known answer-engine hosts',
  },
] as const;

/** Headline value props shown in the Features grid. */
export interface FeatureEntry {
  title: string;
  blurb: string;
  icon: IconKey;
}

export const FEATURES: readonly FeatureEntry[] = [
  {
    title: 'Audit for AI search',
    blurb:
      'A single score for how crawlable, structured, and citable your site is across answer engines — with the fixes that move it.',
    icon: 'gauge',
  },
  {
    title: 'Score your E-E-A-T',
    blurb:
      'Quantify the trust signals LLMs reward. Find missing authorship, citations, and credibility markers page by page.',
    icon: 'shield',
  },
  {
    title: 'Generate llms.txt',
    blurb:
      'Ship the crawl-hint file answer engines look for. Auto-built from your sitemap so bots map your best content first.',
    icon: 'doc',
  },
  {
    title: 'Track AI visibility',
    blurb:
      'Ground decisions in your own GA4 + Search Console data and map the backlinks that build topical authority.',
    icon: 'spark',
  },
] as const;

/** AI surfaces the toolkit optimizes for, rendered as the trust strip. */
export const ENGINES: readonly string[] = [
  'ChatGPT',
  'Claude',
  'Perplexity',
  'Gemini',
  'Google AI Overviews',
] as const;

/** The three high-level steps shown in "How it works". */
export interface StepEntry {
  title: string;
  blurb: string;
}

export const STEPS: readonly StepEntry[] = [
  {
    title: 'Connect & audit',
    blurb:
      'Point the toolkit at your URL. It crawls your pages and scores technical SEO, AEO, and E-E-A-T in one pass.',
  },
  {
    title: 'Get prioritized fixes',
    blurb:
      'Receive a ranked fix list with ready-to-use templates — llms.txt, schema, and the content changes that matter most.',
  },
  {
    title: 'Track your citations',
    blurb:
      'Ship the fixes, then watch your GA4, Search Console, and backlink signals climb as AI engines start citing you.',
  },
] as const;

/** AEO-vs-SEO compare rows. */
export interface CompareRow {
  aspect: string;
  seo: string;
  aeo: string;
}

export const COMPARE: readonly CompareRow[] = [
  { aspect: 'Goal', seo: 'Rank a blue link', aeo: 'Get cited in the answer' },
  {
    aspect: 'Surface',
    seo: 'Search results page',
    aeo: 'ChatGPT, Claude, Perplexity, AI Overviews',
  },
  {
    aspect: 'Wins on',
    seo: 'Keywords & backlinks',
    aeo: 'Structure, E-E-A-T & extractable answers',
  },
  { aspect: 'Measured by', seo: 'Position & clicks', aeo: 'Citations & mentions' },
] as const;

/** Headline stats for the WHY callouts. */
export const STATS: readonly { value: string; label: string }[] = [
  { value: '5', label: 'tools in one console' },
  { value: '100', label: 'point audit score' },
  { value: '4', label: 'E-E-A-T pillars scored' },
  { value: '0', label: 'cost to start' },
] as const;

/**
 * Animated "by the numbers" proof band — every figure is a verifiable capability of the
 * toolkit (not a fabricated customer result), so the band stays honest while reading like
 * the results stat band on high-converting SaaS landings.
 */
export interface ProofStat {
  /** Numeric target the CountUp animates to. */
  to: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

export const PROOF_STATS: readonly ProofStat[] = [
  { to: 50, label: 'pages crawled per audit' },
  { to: 100, label: 'point technical SEO + AEO score' },
  { to: 5, label: 'answer engines you optimize for' },
  { to: 3, label: 'MCP servers for AI clients' },
  { to: 0, prefix: '$', label: 'to run your first audit' },
] as const;

/** A single FAQ entry — rendered visibly *and* mirrored into `FAQPage` JSON-LD. */
export interface FaqEntry {
  question: string;
  answer: string;
}

export const FAQS: readonly FaqEntry[] = [
  {
    question: 'What is Answer Engine Optimization (AEO)?',
    answer:
      'Answer Engine Optimization is the practice of structuring your site so AI answer engines — ChatGPT, Claude, Perplexity, Gemini, and Google AI Overviews — can find, trust, and cite your content. Unlike classic SEO, which optimizes for blue-link rankings, AEO optimizes for being quoted directly inside AI-generated answers.',
  },
  {
    question: 'How is AEO different from SEO?',
    answer:
      'SEO aims to rank a page in search results; AEO aims to get your content cited inside an AI answer. AEO leans more on machine-readable structure (JSON-LD, llms.txt), demonstrable E-E-A-T, and short, extractable answers that a model can lift verbatim. Strong SEO still helps, but it is not sufficient on its own.',
  },
  {
    question: 'Does llms.txt actually help AI visibility?',
    answer:
      'llms.txt is an emerging convention that gives AI crawlers a curated map of your most important pages, much like a sitemap tailored for LLMs. It helps answer engines discover and prioritize your best content. The AEO Toolkit generates a structured llms.txt (and optional llms-full.txt) from your sitemap automatically.',
  },
  {
    question: 'What is a good E-E-A-T score?',
    answer:
      'E-E-A-T stands for Experience, Expertise, Authoritativeness, and Trust. There is no single official number, but higher is better across all four pillars. The E-E-A-T Scanner scores each pillar page by page and shows the exact signals — author bylines, citations, credentials, and trust markers — that each page is missing.',
  },
  {
    question: 'Is the AEO Toolkit free to use?',
    answer:
      'Yes. You can run a technical SEO and AEO audit, scan E-E-A-T, generate llms.txt, and explore the backlink graph for free. The GA4 + Search Console chat is bring-your-own-key (BYOK), so it runs on your own LLM credentials and connects to Google with read-only access.',
  },
] as const;
