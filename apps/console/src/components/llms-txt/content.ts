/**
 * Static content for the llms.txt tool page — answer-first explainer, HowTo steps,
 * and FAQ. Kept in one place so the visible HTML and the JSON-LD stay in lockstep
 * (single source of truth for the FAQPage / HowTo structured data).
 */

export interface HowToStep {
  name: string;
  text: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** Numbered steps shown in the "How it works" section and the HowTo JSON-LD. */
export const HOW_TO_STEPS: readonly HowToStep[] = [
  {
    name: 'Enter your site URL',
    text: 'Paste your homepage or any page on your domain. The generator normalizes the scheme and treats it as the crawl root.',
  },
  {
    name: 'Crawl and extract',
    text: 'We fetch your sitemap first (falling back to link discovery), then extract each page’s title and meta description so the file describes real, indexable content.',
  },
  {
    name: 'Review the output',
    text: 'A structured llms.txt is rendered in the panel — a curated, link-first map of your site grouped under clear headings, exactly as the llmstxt.org spec recommends.',
  },
  {
    name: 'Download and publish',
    text: 'Copy or download the file and host it at https://yourdomain.com/llms.txt (and optionally llms-full.txt) so AI crawlers can find your canonical content map.',
  },
];

/** Visible FAQ — mirrored 1:1 into the FAQPage JSON-LD. */
export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: 'What is llms.txt?',
    answer:
      'llms.txt is a plain-text file you publish at the root of your domain (/llms.txt) that gives large language models a clean, curated map of your most important content. It is to AI crawlers what a sitemap is to search engines: a concise, link-first guide that helps models find and quote the right pages instead of guessing from raw HTML.',
  },
  {
    question: 'Does llms.txt actually help AI visibility?',
    answer:
      'It removes friction. AI crawlers and answer engines have limited context budgets, so a curated llms.txt makes your canonical, high-value pages easy to discover and extract — improving the odds your content is cited accurately in ChatGPT, Claude, Perplexity, and AI Overviews. It complements (does not replace) clean semantic HTML, structured data, and a regular sitemap.',
  },
  {
    question: 'What is the difference between llms.txt and llms-full.txt?',
    answer:
      'llms.txt is a short index of links with one-line summaries — the table of contents. llms-full.txt is an expanded variant that inlines more of the underlying content so a model can ingest the substance in a single fetch. Ship llms.txt for everyone; add llms-full.txt when you want models to read full content without crawling each link.',
  },
  {
    question: 'Where do I put the generated file?',
    answer:
      'Host it at the web root so it resolves at https://yourdomain.com/llms.txt. On most frameworks that means dropping it in your public/static directory or serving it from a route. Re-generate and re-publish whenever your site structure changes so the map stays accurate.',
  },
  {
    question: 'Is the llms.txt generator free?',
    answer:
      'Yes. The llms.txt generator is part of the open-source AEO Toolkit and is free to use — no account required. It runs the crawl on demand and returns the file for you to copy or download.',
  },
];
