import type { JSX } from 'react';
import type { Metadata } from 'next';
import { ChatWorkspace } from '@/components/chat/ChatWorkspace.js';
import { JsonLd } from '@/components/seo/JsonLd';
import { Badge, Container, GradientText, Reveal, SpotlightCard } from '@/components/ui';

const SITE_URL = process.env.MCP_PUBLIC_URL ?? 'https://aeo-toolkit-ten.vercel.app';
const PAGE_PATH = '/tools/chat';
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;

export const metadata: Metadata = {
  title: 'GA4 + Search Console Chat — Ask Your SEO Data in Plain English',
  description:
    'Chat with your own Google Analytics 4 and Search Console data. Connect Google read-only, bring your own LLM key, and get grounded SEO answers — no dashboards required.',
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: 'website',
    url: PAGE_URL,
    title: 'GA4 + Search Console Chat — Ask Your SEO Data in Plain English',
    description:
      'Connect GA4 + Search Console read-only, bring your own LLM key, and ask SEO questions grounded in your real Google data.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GA4 + Search Console Chat — AEO Toolkit',
    description:
      'Ask SEO questions grounded in your own GA4 + Search Console data, answered by your own LLM key.',
  },
};

/** Answer-first FAQ — rendered as visible HTML and mirrored into FAQPage JSON-LD below. */
const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'What is the GA4 + Search Console chat?',
    a: 'It is a free tool that lets you ask plain-English questions about your own Google Analytics 4 and Google Search Console data. It connects read-only to your Google account, pulls the relevant metrics, and uses your own LLM key to return a grounded, written answer — so you skip building dashboards and reports.',
  },
  {
    q: 'Is my Google data safe?',
    a: 'Yes. The connection is read-only — the tool can read GA4 and Search Console reports but can never modify your account. Data is fetched per request to answer your question and is not stored on our servers.',
  },
  {
    q: 'Do I need to pay for the AI model?',
    a: 'You bring your own LLM key (BYOK). Supported providers include Anthropic (Claude), OpenAI, Groq, Perplexity Sonar, and the Vercel AI Gateway. Your key is sent only with the request and is never stored or logged server-side, so you pay your provider directly at cost.',
  },
  {
    q: 'What kinds of questions can I ask?',
    a: 'Ask about click-through-rate gaps, declining impressions, low-engagement landing pages, or performance splits by device and country. Preset prompts cover the most common SEO investigations, and you can type any custom question about your GA4 or Search Console data.',
  },
  {
    q: 'Which GA4 property and Search Console site does it use?',
    a: 'You choose. After connecting Google you pick the Search Console site and enter or select the GA4 property ID you want the assistant to ground its answers in. You can switch between properties at any time.',
  },
];

const HOW_IT_WORKS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'Connect Google',
    body: 'Authorize read-only access to GA4 and Search Console. The tool can read your reports but never writes to your account.',
  },
  {
    title: 'Pick data sources',
    body: 'Select the Search Console site and GA4 property the assistant should ground every answer in.',
  },
  {
    title: 'Add your LLM key',
    body: 'Choose a provider and paste your own key. It is request-scoped only — never stored or logged on the server.',
  },
  {
    title: 'Ask in plain English',
    body: 'Use a preset prompt or type your own question. Answers cite your real Google metrics, not generic advice.',
  },
];

export default function ChatToolPage(): JSX.Element {
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE_URL}/#tools` },
      { '@type': 'ListItem', position: 3, name: 'GA4 + Search Console Chat', item: PAGE_URL },
    ],
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  const howToLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to chat with your GA4 and Search Console data',
    description:
      'Connect Google read-only, pick your data sources, bring your own LLM key, and ask SEO questions grounded in your real Google data.',
    step: HOW_IT_WORKS.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.title,
      text: s.body,
    })),
  };

  const webPageLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'GA4 + Search Console Chat',
    url: PAGE_URL,
    description:
      'Ask plain-English SEO questions grounded in your own GA4 and Search Console data, answered by your own LLM key.',
    isPartOf: { '@type': 'WebSite', name: 'AEO Toolkit', url: SITE_URL },
  };

  return (
    <>
      <JsonLd data={[webPageLd, breadcrumbLd, howToLd, faqLd]} />

      <div className="relative">
        {/* Subtle radial glow behind the hero */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-radial-glow opacity-60"
        />

        <Container className="flex flex-col gap-12 py-12 sm:py-16">
          {/* Hero */}
          <header className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <Reveal>
              <Badge tone="cyan">GA4 + Search Console</Badge>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
                Chat with your <GradientText>GA4 + Search Console</GradientText> data
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="max-w-2xl text-balance text-base leading-relaxed text-slate-400 sm:text-lg">
                Ask plain-English SEO questions and get answers grounded in your own Google data.
                Connect read-only, bring your own LLM key, and skip the dashboards — the assistant
                reads your real GA4 and Search Console metrics to answer.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <ul className="flex flex-wrap items-center justify-center gap-2.5">
                <Badge tone="violet">Read-only access</Badge>
                <Badge tone="indigo">Bring your own key</Badge>
                <Badge tone="neutral">Nothing stored</Badge>
              </ul>
            </Reveal>
          </header>

          {/* Interactive workspace island */}
          <div className="mx-auto w-full max-w-3xl">
            <ChatWorkspace initialConnected={false} />
          </div>

          {/* How it works */}
          <section aria-labelledby="how-it-works" className="mx-auto w-full max-w-4xl scroll-mt-24">
            <Reveal>
              <div className="flex flex-col gap-2 text-center">
                <span className="eyebrow mx-auto">How it works</span>
                <h2
                  id="how-it-works"
                  className="text-3xl font-semibold tracking-tight text-white sm:text-4xl"
                >
                  From Google to answer in four steps
                </h2>
              </div>
            </Reveal>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS.map((step, i) => (
                <Reveal key={step.title} delay={i * 0.05}>
                  <SpotlightCard className="h-full">
                    <div className="flex h-full flex-col gap-3 p-5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#6366F1,#22D3EE)] text-sm font-bold text-white">
                        {i + 1}
                      </span>
                      <h3 className="text-base font-semibold text-white">{step.title}</h3>
                      <p className="text-sm leading-relaxed text-slate-400">{step.body}</p>
                    </div>
                  </SpotlightCard>
                </Reveal>
              ))}
            </ol>
          </section>

          {/* FAQ */}
          <section aria-labelledby="faq" className="mx-auto w-full max-w-3xl scroll-mt-24">
            <Reveal>
              <div className="flex flex-col gap-2 text-center">
                <span className="eyebrow mx-auto">FAQ</span>
                <h2
                  id="faq"
                  className="text-3xl font-semibold tracking-tight text-white sm:text-4xl"
                >
                  Frequently asked questions
                </h2>
              </div>
            </Reveal>
            <dl className="mt-8 flex flex-col gap-3">
              {FAQ.map((item, i) => (
                <Reveal key={item.q} delay={i * 0.04}>
                  <details className="surface group p-5 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                      <dt className="text-base font-medium text-white">{item.q}</dt>
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>
                    <dd className="mt-3 text-sm leading-relaxed text-slate-400">{item.a}</dd>
                  </details>
                </Reveal>
              ))}
            </dl>
          </section>
        </Container>
      </div>
    </>
  );
}
