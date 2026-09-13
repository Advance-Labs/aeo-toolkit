/**
 * Glossary content — the definitional-citation surface (#35).
 *
 * Definitional queries ("what is AEO?") are where answer engines cite most readily, and a
 * definition only wins that citation when it can be lifted verbatim. So every term leads with
 * `definition`: one to two self-contained sentences that answer the question with no pronouns
 * dangling back to context an LLM will not quote. Depth, nuance, and links live in `body`.
 *
 * Pure data, no JSX — pages render it, `sitemap.ts` and the llms.txt route enumerate it, and
 * `content.test.ts` enforces the invariants (unique slugs, resolvable related links,
 * answer-first definitions of liftable length).
 */

export interface GlossaryFaq {
  question: string;
  answer: string;
}

export interface GlossaryTerm {
  /** URL segment under /glossary/. Kebab-case, stable — it is the term's permalink. */
  slug: string;
  /** Display name, e.g. "Answer Engine Optimization (AEO)". */
  term: string;
  /** The question the page exists to answer — used as the h1 lead-in and metadata. */
  question: string;
  /** ≤160-char metadata description; benefit-led, contains the term once. */
  metaDescription: string;
  /** Answer-first definition (1–2 sentences an LLM can lift verbatim). */
  definition: string;
  /** Depth paragraphs, rendered in order after the definition. */
  body: ReadonlyArray<string>;
  /** Slugs of related glossary terms (must resolve — enforced by content.test.ts). */
  related: ReadonlyArray<string>;
  /** The toolkit tools that put this concept to work. */
  tools: ReadonlyArray<{ label: string; href: string }>;
  /** Optional page-specific FAQ, mirrored 1:1 into FAQPage JSON-LD. */
  faq?: ReadonlyArray<GlossaryFaq>;
}

export const GLOSSARY_TERMS: ReadonlyArray<GlossaryTerm> = [
  {
    slug: 'answer-engine-optimization',
    term: 'Answer Engine Optimization (AEO)',
    question: 'What is Answer Engine Optimization?',
    metaDescription:
      'Answer Engine Optimization (AEO) is the practice of structuring content so AI assistants cite it. Learn how AEO works and how to audit it free.',
    definition:
      'Answer Engine Optimization (AEO) is the practice of structuring a website’s content and technical signals so that AI assistants — ChatGPT, Claude, Perplexity, Gemini, and Google AI Overviews — cite it when answering questions in its domain. Where classic SEO competes for a ranked position on a results page, AEO competes to be quoted inside the AI’s answer itself.',
    body: [
      'AEO matters because AI answers are becoming the first — and often the only — surface a searcher sees. When an assistant answers "what is the best tool for X?" directly, the sites it cites capture the trust and the click; every other ranking becomes invisible. The winners of that selection are not chosen by ad auction: answer engines pick sources that are crawlable, verifiably trustworthy, and written in a shape they can quote.',
      'In practice AEO work falls into four layers: crawlability (AI bots like GPTBot, ClaudeBot, and PerplexityBot must be allowed in, with llms.txt as the site map written for them), structured data (JSON-LD that lets an engine resolve who you are and what the page asserts), extractable writing (answer-first openings, question-shaped headings, lists and tables an LLM can quote cleanly), and demonstrated trust (the E-E-A-T signals that decide whether you are safe to cite).',
      'AEO is sometimes called GEO (Generative Engine Optimization) — the two terms describe the same discipline from different angles, and both build on rather than replace technical SEO: an unindexable site can be neither ranked nor cited.',
    ],
    related: [
      'generative-engine-optimization',
      'answer-engine',
      'llms-txt',
      'e-e-a-t',
      'ai-citation',
    ],
    tools: [
      { label: 'Run a free SEO + AEO audit', href: '/tools/audit' },
      { label: 'Generate your llms.txt', href: '/tools/llms-txt' },
    ],
    faq: [
      {
        question: 'Is AEO different from SEO?',
        answer:
          'They optimize for different outcomes on shared foundations. SEO targets a ranked position on a search results page; AEO targets being quoted inside an AI-generated answer. Crawlability, structured data, and site quality feed both — but AEO adds AI-crawler access, llms.txt, extractable answer-shaped writing, and entity consistency that classic SEO checklists never covered.',
      },
      {
        question: 'How do I know if AEO is working?',
        answer:
          'Ask the engines your customers’ questions and record whether you are cited, at what position, and against which competitors — then track it over time. On-page, run a periodic AEO audit to confirm the technical signals (AI-bot access, llms.txt, JSON-LD, answer-first structure) stay in place.',
      },
    ],
  },
  {
    slug: 'generative-engine-optimization',
    term: 'Generative Engine Optimization (GEO)',
    question: 'What is Generative Engine Optimization?',
    metaDescription:
      'Generative Engine Optimization (GEO) is optimizing content to be cited by generative AI search. See how GEO relates to AEO and how to measure it.',
    definition:
      'Generative Engine Optimization (GEO) is the practice of optimizing content so that generative AI systems — ChatGPT, Perplexity, Google AI Overviews, and other LLM-powered search experiences — include and cite it when synthesizing answers. GEO and Answer Engine Optimization (AEO) are two names for substantially the same discipline.',
    body: [
      'The term comes from the research literature: the 2023 paper that coined GEO measured how content changes (citing sources, adding statistics, clearer structure) affect how often generative engines include a page in their synthesized answers. Industry usage has since converged with AEO — some teams say GEO when they emphasize the generative synthesis step, and AEO when they emphasize the question-answering surface, but audits, tactics, and measurements are shared.',
      'Whichever name you use, the work is the same: let AI crawlers in, publish machine-readable structured data, write answer-first extractable content, and build the entity and trust signals engines corroborate before citing. If your organization already has an SEO function, GEO/AEO extends it rather than replacing it.',
    ],
    related: ['answer-engine-optimization', 'answer-engine', 'ai-citation'],
    tools: [{ label: 'Run a free SEO + AEO audit', href: '/tools/audit' }],
  },
  {
    slug: 'answer-engine',
    term: 'Answer engine',
    question: 'What is an answer engine?',
    metaDescription:
      'An answer engine answers questions directly with cited sources instead of listing links. See how answer engines choose what to cite.',
    definition:
      'An answer engine is a search system that responds to a question with a direct, synthesized answer — usually generated by a large language model and backed by cited sources — instead of a ranked list of links. ChatGPT with search, Perplexity, Google AI Overviews, and Claude with web access are all answer engines.',
    body: [
      'The defining difference from a classic search engine is who does the reading. A search engine hands you ten links and you synthesize the answer; an answer engine reads the sources itself and hands you its synthesis, attributing the claims it kept. That flips the visibility economics: instead of ten winners per query there are often two or three cited sources, and everything else contributes nothing.',
      'Answer engines choose their citations from content they can crawl, parse, and trust. They favor pages that answer the question directly near the top, mark up their claims with structured data, and belong to entities the engine can resolve and corroborate — which is exactly the checklist Answer Engine Optimization works through.',
    ],
    related: ['answer-engine-optimization', 'ai-citation', 'ai-crawler'],
    tools: [{ label: 'Run a free SEO + AEO audit', href: '/tools/audit' }],
  },
  {
    slug: 'llms-txt',
    term: 'llms.txt',
    question: 'What is llms.txt?',
    metaDescription:
      'llms.txt is a root-level markdown file that gives AI crawlers a curated map of your site. Learn the format and generate yours free.',
    definition:
      'llms.txt is a plain-markdown file served at a website’s root (example.com/llms.txt) that gives AI systems a curated, LLM-friendly map of the site: what it is, and which pages best represent it. Where robots.txt tells crawlers what they may not access, llms.txt tells AI crawlers what is most worth reading.',
    body: [
      'The format, proposed at llmstxt.org, is deliberately simple: an H1 with the site name, a one-paragraph summary blockquote, then H2 sections of annotated links. A companion llms-full.txt can inline the full content of the linked pages for engines that prefer one fetch. Because it is markdown, the file doubles as a human-readable site summary.',
      'llms.txt earns its place through economics: LLM crawlers spend a limited budget per site and parse imperfectly. A curated map spends that budget on your best pages, described in your own words — rather than leaving an engine to infer your site’s shape from whatever navigation it happened to parse.',
      'It complements rather than replaces the classic crawl files: robots.txt still governs access, sitemap.xml still enumerates URLs exhaustively, and llms.txt curates. This site ships all three — the llms.txt at /llms.txt is generated by the toolkit’s own generator.',
    ],
    related: ['ai-crawler', 'answer-engine-optimization', 'structured-data'],
    tools: [
      { label: 'Generate your llms.txt free', href: '/tools/llms-txt' },
      { label: 'Audit your crawl files', href: '/tools/audit' },
    ],
    faq: [
      {
        question: 'Does llms.txt actually help AI visibility?',
        answer:
          'It is an inexpensive positive signal, not a silver bullet. Adoption by AI crawlers is still uneven, but the file costs minutes to generate, cannot hurt, is read by a growing set of agents and tools, and — like structured data in the early days of rich results — rewards the sites that shipped it before it became table stakes.',
      },
      {
        question: 'Where does llms.txt go?',
        answer:
          'At the web root, next to robots.txt: https://example.com/llms.txt. If you publish the optional llms-full.txt, it sits at the root as well. Serve both as plain text or markdown with a 200 status.',
      },
    ],
  },
  {
    slug: 'e-e-a-t',
    term: 'E-E-A-T',
    question: 'What is E-E-A-T?',
    metaDescription:
      'E-E-A-T stands for Experience, Expertise, Authoritativeness, and Trust — the signals engines weigh before citing you. Check your score free.',
    definition:
      'E-E-A-T stands for Experience, Expertise, Authoritativeness, and Trustworthiness — the framework from Google’s Search Quality Rater Guidelines for judging whether content deserves to rank, and increasingly, whether AI answer engines consider it safe to cite. It is demonstrated on the page, not asserted: bylines, credentials, first-hand evidence, citations, and a resolvable organization behind the site.',
    body: [
      'The four pillars ask different questions. Experience: has the author actually done the thing — used the product, run the migration, treated the condition? Expertise: do they have the knowledge or credentials the topic demands? Authoritativeness: do others — links, mentions, profiles — corroborate this source as a reference? Trustworthiness, the pillar Google calls most important: is the site accurate, honest about who is behind it, secure, and free of deceptive patterns?',
      'Answer engines inherit this calculus with higher stakes: an assistant that quotes you is vouching for you in its own voice, so it prefers sources whose authorship and identity it can verify mechanically — Person and Organization structured data, consistent entity details across pages, an about page, contactability, and citations to primary sources.',
      'E-E-A-T is not a score Google publishes; it is a rubric their raters apply and their systems approximate. You can, however, audit the on-page signals that feed it — which is what the toolkit’s E-E-A-T scanner does across all four pillars.',
    ],
    related: ['answer-engine-optimization', 'structured-data', 'ai-citation'],
    tools: [{ label: 'Check your E-E-A-T score free', href: '/tools/eeat' }],
    faq: [
      {
        question: 'What is a good E-E-A-T score?',
        answer:
          'In the toolkit’s scanner, aim for 80+ overall with no empty pillar. A high average hiding a zero — strong expertise signals but no trust page, say — reads worse to engines than a balanced profile, because the missing pillar is exactly the check they cannot corroborate.',
      },
    ],
  },
  {
    slug: 'ai-citation',
    term: 'AI citation',
    question: 'What is an AI citation?',
    metaDescription:
      'An AI citation is when an AI assistant names your site as a source in its answer. Learn how citations are chosen and how to win them.',
    definition:
      'An AI citation is an attribution inside an AI-generated answer — a link, footnote, or named mention that credits a website as the source of a claim. Citations are the currency of AI search: they are how a site is visible at all inside ChatGPT, Perplexity, or Google AI Overviews, and they carry the referral traffic and brand trust that ranked links used to.',
    body: [
      'Not all citations are equal. Being the named recommendation in the prose ("the best free tool for this is X") is worth more than a footnote source; being cited for your own name is table stakes, while being cited for the money questions your customers ask ("best CRM for contractors") is the outcome AEO actually optimizes for. Tracking citation rate and position per query, per engine, over time is how AI visibility is measured.',
      'Engines cite what they can retrieve, parse, and defend. Retrieval requires crawl access and indexable content; parsing rewards answer-first structure and clean markup; defensibility favors sources with strong E-E-A-T signals — the engine is lending you its credibility, and it prices that risk.',
    ],
    related: ['answer-engine', 'answer-engine-optimization', 'e-e-a-t'],
    tools: [
      { label: 'Audit your citability', href: '/tools/audit' },
      { label: 'Track visibility via the AI Visibility MCP', href: '/mcp' },
    ],
  },
  {
    slug: 'structured-data',
    term: 'Structured data (JSON-LD)',
    question: 'What is structured data?',
    metaDescription:
      'Structured data is machine-readable schema.org markup (usually JSON-LD) that tells engines what a page asserts. Validate yours free.',
    definition:
      'Structured data is machine-readable markup — on the modern web, almost always JSON-LD using schema.org vocabulary — embedded in a page to state unambiguously what the page is about: who published it, who wrote it, what it answers, and how its entities relate. It is the layer search and answer engines read when they need facts rather than prose.',
    body: [
      'For AEO, a handful of types do most of the work. Organization and Person establish who is behind the content (feeding E-E-A-T); FAQPage and HowTo hand engines pre-extracted question–answer pairs and step lists; Article with dateModified proves freshness; BreadcrumbList maps site structure; WebSite ties it all to one entity. Consistency matters as much as presence — the same organization must carry the same @id and url on every page, or engines see several entities where there is one.',
      'JSON-LD won as the format because it lives in one script tag, decoupled from the visible HTML — but that decoupling is also its failure mode: markup that drifts from what the page actually shows, or that never parses at all. Validating structured data — all three encodings, JSON-LD, Microdata, and RDFa — is a standard part of the toolkit’s audit.',
    ],
    related: ['answer-engine-optimization', 'e-e-a-t', 'llms-txt'],
    tools: [{ label: 'Audit your structured data', href: '/tools/audit' }],
  },
  {
    slug: 'ai-crawler',
    term: 'AI crawler',
    question: 'What is an AI crawler?',
    metaDescription:
      'AI crawlers like GPTBot, ClaudeBot, and PerplexityBot fetch web content for AI systems. Learn who they are and how to manage access.',
    definition:
      'An AI crawler is a bot that fetches web content on behalf of an AI system — for training, for live retrieval when a user asks a question, or both. The ones that matter most for visibility are GPTBot and OAI-SearchBot (OpenAI), ClaudeBot (Anthropic), PerplexityBot, and Google-Extended (Google’s AI training control). Each identifies itself by user-agent and respects robots.txt.',
    body: [
      'Access is a genuine strategic choice, but many sites make it by accident: a blanket bot-blocking rule, a CDN default, or a robots.txt copied from a template quietly locks out every AI crawler — and a site AI systems cannot read is a site they will never cite. The first step of any AEO effort is simply confirming that the engines you want citations from are allowed in.',
      'Retrieval-time crawlers (OAI-SearchBot, PerplexityBot, ChatGPT-User) deserve different treatment from training-only ones: blocking them does not keep your content out of a model — it keeps your name out of the answers. The toolkit’s audit checks your robots.txt directives against each of the key AI bots and flags accidental blocks.',
    ],
    related: ['llms-txt', 'answer-engine', 'answer-engine-optimization'],
    tools: [
      { label: 'Check your AI-bot access', href: '/tools/audit' },
      { label: 'Generate an AI-friendly llms.txt', href: '/tools/llms-txt' },
    ],
  },
];

/** Term lookup by slug; undefined when the slug is not a glossary term. */
export function glossaryTerm(slug: string): GlossaryTerm | undefined {
  return GLOSSARY_TERMS.find((t) => t.slug === slug);
}
